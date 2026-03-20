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
          <p style="text-align: center; font-size: 12px; color: #888;">Payment Method: ${receiptData.paymentMethod}</p>
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

async function sendAdminWelcomeEmail(email, name, role) {
  try {
    console.log(`⏳ Sending Admin Welcome Email to: ${email}...`);

    const mailOptions = {
      from: `"Puerto Palabra Library System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to the Team! - Puerto Palabra Library",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
          <h2 style="color: #183B5B; text-align: center;">Welcome to Puerto Palabra!</h2>
          <p style="color: #333; font-size: 16px;">Dear <strong>${name}</strong>,</p>
          
          <p style="color: #555; line-height: 1.6;">
            We are pleased to inform you that you have been appointed as a <strong>${role}</strong> at Puerto Palabra Library.
            Your account has been successfully created.
          </p>

          <div style="background-color: #fff; padding: 15px; border-left: 4px solid #D6A84A; margin: 20px 0;">
            <p style="margin: 5px 0; color: #333;"><strong>Login Credentials:</strong></p>
            <p style="margin: 5px 0; color: #555;">Email: ${email}</p>
          </div>

          <p style="color: #555; font-size: 14px;">
            Please log in to the admin portal to access your dashboard. We recommend changing your password upon your first login for security purposes.
          </p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="text-align: center; color: #999; font-size: 12px;">Puerto Palabra Library Management System</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Admin Welcome Email sent successfully.");
    return true;
  } catch (error) {
    console.error("❌ Admin Email Error:", error);
    return false;
  }
}

async function sendOtpEmail(email, otp, purpose = 'Password Reset') {
  try {
    console.log(`⏳ Sending OTP to: ${email}...`);
    
    let title = purpose === 'Registration' ? 'Email Verification' : 'Password Reset Request';
    let desc = purpose === 'Registration' ? 'Your email verification code is:' : 'Your One-Time Password (OTP) is:';

    const mailOptions = {
      from: `"Puerto Palabra Library System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${title} - Puerto Palabra`,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
               <h2 style="color: #183B5B;">${title}</h2>
               <p>${desc}</p>
               <h1 style="color: #D6A84A; letter-spacing: 5px;">${otp}</h1>
               <p>This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
             </div>`
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ OTP Email sent successfully.");
    return true;
  } catch (error) {
    console.error("❌ OTP Email Error:", error);
    return false;
  }
}

async function sendAccountStatusEmail(email, name, status, reason = null) {
  try {
    console.log(`⏳ Sending Status Email to: ${email}...`);
    
    let subject = "Account Status Update - Puerto Palabra";
    let color = "#183B5B";
    let message = "";
    let headerText = "Registration Update";

    if (status === 'Active') {
        subject = "Account Approved - Puerto Palabra";
        color = "#2E5F87";
        headerText = "Welcome Aboard!";
        message = "Your account has been approved. You may now log in to the library system.";
    } else if (status === 'Rejected') {
        subject = "Account Registration Update - Puerto Palabra";
        color = "#C05640";
        headerText = "Registration Update";
        message = "We regret to inform you that your account registration has been declined.";
        if (reason) {
            message += `<br><br><strong>Reason:</strong> ${reason}`;
        }
    } else if (status === 'Pending') {
        subject = "Registration Received - Puerto Palabra";
        color = "#D6A84A";
        headerText = "Registration Received";
        message = "We have received your registration request. Please wait while our administrators review your account. You will receive an email with your Digital Library Card once approved.";
    } else if (status === 'Banned') {
        subject = "Account Banned - Puerto Palabra";
        color = "#8B0000";
        headerText = "Account Permanently Banned";
        message = "We regret to inform you that your library account has been permanently banned due to severe policy violations.";
        if (reason) {
            message += `<br><br><strong>Reason:</strong> ${reason}`;
        }
    } else if (status === 'Suspended') {
        subject = "Account Suspended - Puerto Palabra";
        color = "#C05640";
        headerText = "Account Temporarily Suspended";
        message = "Your library account has been suspended.";
        if (reason) {
            message += `<br><br><strong>Reason:</strong> ${reason}`;
        }
    } else {
        message = `Your account status has been updated to: ${status}.`;
    }

    const mailOptions = {
      from: `"Puerto Palabra Library System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
               <h2 style="color: ${color};">${headerText}</h2>
               <p>Dear ${name},</p>
               <p>${message}</p>
               <p>Regards,<br>Puerto Palabra Admin</p>
             </div>`
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Status Email sent successfully.");
    return true;
  } catch (error) {
    console.error("❌ Status Email Error:", error);
    return false;
  }
}

module.exports = { sendLibraryCard, sendPaymentReceipt, sendAdminWelcomeEmail, sendOtpEmail, sendAccountStatusEmail };