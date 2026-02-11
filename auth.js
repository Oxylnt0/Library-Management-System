const path = require('path');
const { db } = require(path.join(process.cwd(), 'db_config.js'));
const { sendLibraryCard } = require(path.join(process.cwd(), 'email_service.js'));

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
        await sendLibraryCard(userData.email, userId, userData.firstName);

        return { success: true, message: "User registered successfully!" };
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

        return { success: true, message: "Guardian and Child registered successfully!" };
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
            return { success: true, role: 'user', user: userResult.rows[0] };
        }

        // Check Guardian Table
        const guardianResult = await db.execute({
            sql: "SELECT * FROM GUARDIAN_NAME WHERE email = ? AND password = ?",
            args: [email, password]
        });

        if (guardianResult.rows.length > 0) {
            return { success: true, role: 'guardian', user: guardianResult.rows[0] };
        }

        return { success: false, message: "Invalid email or password." };
    } catch (error) {
        console.error("Login Error:", error);
        return { success: false, message: error.message };
    }
}

module.exports = { registerUser, registerGuardian, login };