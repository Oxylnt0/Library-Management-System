const path = require('path');
const { db } = require(path.join(process.cwd(), 'db_config.js'));
const { sendLibraryCard } = require(path.join(process.cwd(), 'email_service.js'));
const { logUserAction, logGuardianAction } = require(path.join(process.cwd(), 'audit_service.js'));

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

        await sendLibraryCard(userData.email, userId, userData.firstName);
        await logUserAction(userId, 'REGISTRATION', 'USER', userId, 'New user registration completed');

        return { success: true, message: "Registration successful! Please wait for admin approval." };
    } catch (error) {
        console.error("Registration Error:", error);
        return { success: false, message: error.message };
    }
}

async function registerGuardian(guardianData, childData) {
    try {
        // 1. Create Guardian Record
        const guardianResult = await db.execute({
            sql: `INSERT INTO GUARDIAN_NAME (
                first_name, last_name, middle_initial, relationship, 
                email, contact_number, address, password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING guardian_id`,
            args: [
                guardianData.firstName,
                guardianData.lastName,
                guardianData.mi,
                guardianData.relationship,
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

        const childResult = await db.execute({
            sql: `INSERT INTO USER (
                first_name, last_name, middle_initial, birth_date, 
                guardian_id, email, password
            ) VALUES (?, ?, ?, ?, ?, NULL, NULL) RETURNING user_id`,
            args: [
                childData.firstName,
                childData.lastName,
                childData.mi,
                childData.birthDate,
                guardianId
            ]
        });

        const childId = childResult.rows[0].user_id;
        await sendLibraryCard(guardianData.email, childId, childData.firstName);
        await logGuardianAction(guardianId, 'REGISTRATION', 'GUARDIAN_NAME', guardianId, 'New guardian registration completed');
        await logUserAction(childId, 'REGISTRATION', 'USER', childId, 'Child account registered via Guardian');

        return { success: true, message: "Registration successful! Please wait for admin approval." };
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
            if (user.status === 'Pending') return { success: false, message: "Account is pending approval." };
            if (user.status === 'Rejected') return { success: false, message: "Account has been rejected." };
            if (user.status === 'Suspended') return { success: false, message: "Account is suspended." };
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
            if (guardian.status === 'Pending') return { success: false, message: "Account is pending approval." };
            if (guardian.status === 'Rejected') return { success: false, message: "Account has been rejected." };
            if (guardian.status === 'Suspended') return { success: false, message: "Account is suspended." };
            await logGuardianAction(guardian.guardian_id, 'LOGIN', 'GUARDIAN_NAME', guardian.guardian_id, 'Guardian logged in successfully');
            return { success: true, role: 'guardian', user: guardian };
        }

        return { success: false, message: "Invalid email or password." };
    } catch (error) {
        console.error("Login Error:", error);
        return { success: false, message: error.message };
    }
}

module.exports = { registerUser, registerGuardian, login };