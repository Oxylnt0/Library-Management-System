// email_service.js
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
require("dotenv").config();

// 1. Configure the Email Transporter (Use your Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your gmail address
    pass: process.env.EMAIL_PASS, // Your gmail APP PASSWORD (not login password)
  },
});

// 2. Main function to Generate QR and Send Email
async function sendLibraryCard(userEmail, userId, userName) {
  try {
    console.log(`⏳ Generating QR Code for User ID: ${userId}...`);

    // --- A. Generate the QR Code Data URL ---
    // We only encode the userId (e.g., "UID-105")
    const qrData = JSON.stringify({ id: userId }); 
    const qrImage = await QRCode.toDataURL(qrData);

    // --- B. Define the Email Content ---
    const mailOptions = {
      from: `"Puerto Palabra Library System" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: "Welcome to Puerto Palabra Library! Here is your Digital Library Card",
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center;">
          <h1>Welcome, ${userName}!</h1>
          <p>Thank you for registering with our library.</p>
          <p>Please save the attached QR code. This is your permanent Library ID.</p>
          <p><strong>Show this to the librarian whenever you use the library and its services.</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `LibraryID_${userId}.png`,
          content: qrImage.split("base64,")[1], // Remove the data:image prefix
          encoding: "base64",
        },
      ],
    };

    // --- C. Send the Email ---
    console.log("📨 Sending email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent: " + info.response);
    return true;

  } catch (error) {
    console.error("❌ Email Error:", error);
    return false;
  }
}

async function sendPaymentReceipt(userEmail, receiptData) {
  try {
    console.log(`⏳ Sending Receipt to: ${userEmail}...`);

    const mailOptions = {
      from: `"Puerto Palabra Library System" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Payment Receipt - ${receiptData.orNumber}`,
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 400px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; background-color: #fff;">
          <h2 style="text-align: center; margin-bottom: 5px;">Puerto Palabra</h2>
          <p style="text-align: center; font-size: 12px; color: #666; margin-top: 0;">Library Management System</p>
          <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">
          
          <p><strong>OR Number:</strong> ${receiptData.orNumber}</p>
          <p><strong>Date:</strong> ${receiptData.date}</p>
          <p><strong>Received From:</strong> ${receiptData.user}</p>
          
          <table style="width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 5px 0;">${receiptData.book} (${receiptData.reason})</td>
              <td style="text-align: right;">₱${receiptData.amount.toFixed(2)}</td>
            </tr>
          </table>
          
          <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">
          <p style="text-align: center; font-size: 14px;"><strong>Total Paid: ₱${receiptData.amount.toFixed(2)}</strong></p>
          <p style="text-align: center; font-size: 12px; color: #888;">Payment Method: Cash</p>
          <p style="text-align: center; margin-top: 30px;">Thank you!</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Receipt sent successfully.");
    return true;
  } catch (error) {
    console.error("❌ Receipt Email Error:", error);
    return false;
  }
}

module.exports = { sendLibraryCard, sendPaymentReceipt };