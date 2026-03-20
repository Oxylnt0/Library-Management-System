const path = require('path');
const { db } = require(path.join(process.cwd(), 'db_config.js'));
const { sendAccountStatusEmail, sendOtpEmail } = require(path.join(process.cwd(), 'email_service.js'));
const { logUserAction, logGuardianAction } = require(path.join(process.cwd(), 'audit_service.js'));

async function generateAndSendRegistrationOTP(email) {
    // Delete old registration OTPs for this email to prevent clogging
    await db.execute({
        sql: "DELETE FROM OTP_VERIFICATION WHERE email = ? AND purpose = 'Registration'",
        args: [email]
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await db.execute({
        sql: "INSERT INTO OTP_VERIFICATION (email, otp_code, purpose, expires_at) VALUES (?, ?, 'Registration', DATETIME('now', '+10 minutes'))",
        args: [email, otp]
    });

    await sendOtpEmail(email, otp, 'Registration');
}

async function verifyRegistrationOTP(email, otp) {
    const resOtp = await db.execute({
        sql: "SELECT * FROM OTP_VERIFICATION WHERE email = ? AND otp_code = ? AND purpose = 'Registration' AND is_used = 0 AND expires_at > DATETIME('now') ORDER BY created_at DESC LIMIT 1",
        args: [email, otp]
    });

    if (resOtp.rows.length > 0) {
        await db.execute({ sql: "UPDATE OTP_VERIFICATION SET is_used = 1 WHERE otp_id = ?", args: [resOtp.rows[0].otp_id] });
        
        // Flag as verified
        await db.execute({ sql: "UPDATE USER SET email_verified = 1 WHERE email = ?", args: [email] });
        await db.execute({ sql: "UPDATE GUARDIAN_NAME SET email_verified = 1 WHERE email = ?", args: [email] });

        // Fetch name for the pending email
        let name = "User";
        const userSearch = await db.execute({ sql: "SELECT first_name FROM USER WHERE email = ? UNION SELECT first_name FROM GUARDIAN_NAME WHERE email = ?", args: [email, email] });
        if (userSearch.rows.length > 0) name = userSearch.rows[0].first_name;

        await sendAccountStatusEmail(email, name, 'Pending');
        return { success: true, message: "Email verified successfully!" };
    } else {
        return { success: false, message: "Invalid or expired OTP." };
    }
}

async function registerUser(userData) {
    try {
        const result = await db.execute({
            sql: `INSERT INTO USER (
                first_name, last_name, middle_initial, email, contact_number, 
                address, birth_date, password, guardian_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL) RETURNING user_id`,
            args: [
                userData.firstName,
                userData.lastName,
                userData.mi,
                userData.email,
                userData.contact,
                userData.address,
                userData.birthDate,
                userData.password
            ]
        });

        const userId = result.rows[0].user_id;

        // Insert Security Questions
        if (userData.securityQuestions && userData.securityQuestions.length === 3) {
            await db.execute({
                sql: `INSERT INTO SECURITY_QUESTIONS (
                    user_id, question_1, answer_1, question_2, answer_2, question_3, answer_3
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    userId,
                    userData.securityQuestions[0].question, userData.securityQuestions[0].answer,
                    userData.securityQuestions[1].question, userData.securityQuestions[1].answer,
                    userData.securityQuestions[2].question, userData.securityQuestions[2].answer
                ]
            });
        }

        if (userData.email) {
            await generateAndSendRegistrationOTP(userData.email);
        }
        await logUserAction(userId, 'REGISTRATION', 'USER', userId, 'New user registration completed');

        return { success: true, message: "Registration successful! Please verify your email." };
    } catch (error) {
        console.error("Registration Error:", error);
        return { success: false, message: error.message };
    }
}

async function registerGuardian(guardianData, childrenData) {
    try {
        // 1. Create Guardian Record
        const guardianResult = await db.execute({
            sql: `INSERT INTO GUARDIAN_NAME (
                first_name, last_name, middle_initial, birth_date, 
                email, contact_number, address, password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING guardian_id`,
            args: [
                guardianData.firstName,
                guardianData.lastName,
                guardianData.mi,
                guardianData.birthDate,
                guardianData.email,
                guardianData.contact,
                guardianData.address,
                guardianData.password
            ]
        });
        
        const guardianId = guardianResult.rows[0].guardian_id;

        // Insert Security Questions
        if (guardianData.securityQuestions && guardianData.securityQuestions.length === 3) {
            await db.execute({
                sql: `INSERT INTO SECURITY_QUESTIONS (
                    guardian_id, question_1, answer_1, question_2, answer_2, question_3, answer_3
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    guardianId,
                    guardianData.securityQuestions[0].question, guardianData.securityQuestions[0].answer,
                    guardianData.securityQuestions[1].question, guardianData.securityQuestions[1].answer,
                    guardianData.securityQuestions[2].question, guardianData.securityQuestions[2].answer
                ]
            });
        }

        if (guardianData.email) {
            await generateAndSendRegistrationOTP(guardianData.email);
        }
        await logGuardianAction(guardianId, 'REGISTRATION', 'GUARDIAN_NAME', guardianId, 'New guardian registration completed');

        for (const child of childrenData) {
            const childResult = await db.execute({
                sql: `INSERT INTO USER (
                    first_name, last_name, middle_initial, birth_date, relationship, 
                    guardian_id, email, password
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL) RETURNING user_id`,
                args: [
                    child.firstName,
                    child.lastName,
                    child.mi,
                    child.birthDate,
                    child.relationship,
                    guardianId
                ]
            });
            const childId = childResult.rows[0].user_id;
            await logUserAction(childId, 'REGISTRATION', 'USER', childId, 'Child account registered via Guardian');
        }

        return { success: true, message: "Registration successful! Please verify your email." };
    } catch (error) {
        console.error("Registration Error:", error);
        return { success: false, message: error.message };
    }
}

async function login(email, password) {
    try {
        // Check User Table
        const userResult = await db.execute({
            sql: "SELECT * FROM USER WHERE email = ? AND password = ?",
            args: [email, password]
        });

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            if (user.email && user.email_verified === 0) return { success: false, requiresOtp: true, email: user.email, message: "Email not verified. Please verify your email." };
            if (user.status === 'Pending') return { success: false, message: "Email verified! Please wait for a Librarian to approve your account." };
            if (user.status === 'Rejected') return { success: false, message: `Your account request was declined. Reason: ${user.status_note || 'Please visit the library for assistance.'}` };
            if (user.status === 'Banned') return { success: false, message: "Account is permanently banned." };
            await logUserAction(user.user_id, 'LOGIN', 'USER', user.user_id, 'User logged in successfully');
            return { success: true, role: 'user', user };
        }

        // Check Guardian Table
        const guardianResult = await db.execute({
            sql: "SELECT * FROM GUARDIAN_NAME WHERE email = ? AND password = ?",
            args: [email, password]
        });

        if (guardianResult.rows.length > 0) {
            const guardian = guardianResult.rows[0];
            if (guardian.email && guardian.email_verified === 0) return { success: false, requiresOtp: true, email: guardian.email, message: "Email not verified. Please verify your email." };
            if (guardian.status === 'Pending') return { success: false, message: "Email verified! Please wait for a Librarian to approve your account." };
            if (guardian.status === 'Rejected') return { success: false, message: `Your account request was declined. Reason: ${guardian.status_note || 'Please visit the library for assistance.'}` };
            if (guardian.status === 'Banned') return { success: false, message: "Account is permanently banned." };
            await logGuardianAction(guardian.guardian_id, 'LOGIN', 'GUARDIAN_NAME', guardian.guardian_id, 'Guardian logged in successfully');
            
            const childrenRes = await db.execute({
                sql: "SELECT user_id, first_name, last_name FROM USER WHERE guardian_id = ?",
                args: [guardian.guardian_id]
            });

            return { success: true, role: 'guardian', user: guardian, children: childrenRes.rows };
        }

        return { success: false, message: "Invalid email or password." };
    } catch (error) {
        console.error("Login Error:", error);
        return { success: false, message: error.message };
    }
}

async function checkEmailExists(email) {
    try {
        const query = `
            SELECT email, status FROM USER WHERE email = ? AND status IN ('Pending', 'Active', 'Suspended', 'Banned')
            UNION ALL
            SELECT email, status FROM GUARDIAN_NAME WHERE email = ? AND status IN ('Pending', 'Active', 'Suspended', 'Banned')
        `;
        const result = await db.execute({
            sql: query,
            args: [email, email]
        });

        if (result.rows.length > 0) {
            return { exists: true, status: result.rows[0].status };
        }
        return { exists: false };
    } catch (error) {
        console.error("Email Check Error:", error);
        return { exists: false }; 
    }
}

module.exports = { registerUser, registerGuardian, login, checkEmailExists, verifyRegistrationOTP, generateAndSendRegistrationOTP };