const express = require("express");
const router = express.Router();
const Student = require("../models/tenants");
const User = require("../models/authUser");
const mongoose = require('mongoose');

// =======================
// 📊 Get Due Tenants
// GET /api/students/due?hostelId=xxx&overdueOnly=true&daysBeforeDue=7
// =======================
router.get("/due", async (req, res) => {
  try {
    console.log("🔵 ===== /students/due API HIT =====");

    const { hostelId, overdueOnly, daysBeforeDue = 7 } = req.query;

    console.log("📥 Query Params:", {
      hostelId,
      overdueOnly,
      daysBeforeDue
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + parseInt(daysBeforeDue));

    console.log("📅 Date Range:", {
      today,
      futureDate
    });

    let query = {
      status: "active",
      autoReminderEnabled: true
    };

    // 🏠 Hostel Filter
    if (hostelId) {
      console.log("🏠 Filtering by hostelId:", hostelId);
      query.hostelId = new mongoose.Types.ObjectId(hostelId);
    }

    // ⏰ Due Logic
    if (overdueOnly === "true") {
      console.log("⚠️ Only overdue tenants");
      query.nextPaymentDate = { $lt: today };
    } else {
      console.log("📊 Fetching overdue + upcoming tenants");
      query.$or = [
        { nextPaymentDate: { $lt: today } },
        { nextPaymentDate: { $gte: today, $lte: futureDate } },
        { nextPaymentDate: null }
      ];
    }

    console.log("🔍 Final Mongo Query:", JSON.stringify(query, null, 2));

    const allStudents = await Student.find({
  hostelId: new mongoose.Types.ObjectId(hostelId)
});

console.log("🧪 All students in this hostel:", allStudents.length);

    const students = await Student.find(query)
      .populate("userId", "name email phone profileImage fcmToken")
      .populate("hostelId", "name address location")
      .populate("room", "roomNumber floor")
      .sort({ nextPaymentDate: 1 });

    console.log(`📦 Students Fetched: ${students.length}`);

    const dueTenants = students.map((student, index) => {
      console.log(`\n👤 Processing Student #${index + 1}`);
      console.log("➡️ Student ID:", student._id);
      console.log("➡️ Name:", student.name);

      const nextPaymentDate = student.nextPaymentDate
        ? new Date(student.nextPaymentDate)
        : null;

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      let daysOverdue = 0;
      let daysUntilDue = 0;
      let isOverdue = false;

      if (nextPaymentDate) {
        const diffTime = todayDate - nextPaymentDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          daysOverdue = diffDays;
          isOverdue = true;
        } else {
          daysUntilDue = Math.abs(diffDays);
        }
      }

      console.log("📅 Payment Info:", {
        nextPaymentDate,
        daysOverdue,
        daysUntilDue,
        isOverdue
      });

      const monthlyRent = student.monthlyRent || 0;
      const pendingAmount = student.pendingAmount || 0;
      const totalDue = monthlyRent + pendingAmount;

      console.log("💰 Financial Info:", {
        monthlyRent,
        pendingAmount,
        totalDue
      });

      const user = student.userId;

      return {
        _id: student._id.toString(),
        name: student.name,
        email: student.email,
        phone: student.phone,
        user: user
          ? {
              _id: user._id.toString(),
              name: user.name,
              email: user.email,
              phone: user.phone,
              profileImage: user.profileImage,
              fcmToken: user.fcmToken
            }
          : null,
        hostel: student.hostelId
          ? {
              _id: student.hostelId._id.toString(),
              name: student.hostelId.name,
              location:
                student.hostelId.location || student.hostelId.address
            }
          : null,
        room: student.room
          ? {
              _id: student.room._id.toString(),
              roomNumber: student.room.roomNumber
            }
          : null,
        roomNumber:
          student.roomNumber ||
          (student.room ? student.room.roomNumber : null),
        bedNumber: student.bedNumber,
        monthlyRent,
        pendingAmount,
        nextPaymentDate: student.nextPaymentDate,
        lastPaymentDate: student.lastPaymentDate,
        lastReminderSent: student.lastReminderSent,
        reminderCount: student.reminderCount || 0,
        daysOverdue,
        daysUntilDue,
        isOverdue,
        reminderPreference: student.reminderPreference || "both",
        canSendSMS: !!(user && user.phone),
        canSendEmail: !!(user && user.email),
        canSendPush: !!(user && user.fcmToken)
      };
    });

    const summary = {
      totalDue: dueTenants.length,
      totalAmount: dueTenants.reduce(
        (sum, t) => sum + t.monthlyRent + t.pendingAmount,
        0
      ),
      overdueCount: dueTenants.filter((t) => t.isOverdue).length,
      totalOverdueAmount: dueTenants
        .filter((t) => t.isOverdue)
        .reduce((sum, t) => sum + t.monthlyRent + t.pendingAmount, 0)
    };

    console.log("📊 Summary:", summary);

    console.log("🟢 ===== RESPONSE SENT SUCCESSFULLY =====\n");

    res.json({
      success: true,
      data: {
        tenants: dueTenants,
        summary
      }
    });
  } catch (error) {
    console.error("❌ ERROR in /students/due:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// =======================
// 📱 Send Single Reminder
// POST /api/students/:id/reminder
// =======================
router.post("/:id/reminder", async (req, res) => {
  try {
    const { id } = req.params;
    const { message, channels } = req.body;

    if (!message || !channels || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message and at least one channel are required'
      });
    }

    const student = await Student.findById(id)
      .populate('userId', 'name email phone fcmToken')
      .populate('hostelId', 'name')
      .populate('room', 'roomNumber');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    if (student.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send reminder to inactive tenant'
      });
    }

    const user = student.userId;
    const totalDue = (student.monthlyRent || 0) + (student.pendingAmount || 0);
    
    const personalizedMessage = message
      .replace(/{name}/g, student.name)
      .replace(/{amount}/g, `₹${totalDue.toLocaleString()}`)
      .replace(/{hostel}/g, student.hostelId?.name || 'Hostel')
      .replace(/{room}/g, student.roomNumber || student.room?.roomNumber || 'N/A')
      .replace(/{dueDate}/g, student.nextPaymentDate ? new Date(student.nextPaymentDate).toLocaleDateString('en-IN') : 'N/A');

    const results = {
      sms: false,
      email: false,
      push: false
    };

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'sms':
            if (user && user.phone) {
              await sendSMS(user.phone, personalizedMessage);
              results.sms = true;
            }
            break;
          
          case 'email':
            if (user && user.email) {
              await sendEmail({
                to: user.email,
                subject: `Rent Payment Reminder - ${student.hostelId?.name || 'Hostel'}`,
                text: personalizedMessage,
                html: `<p>${personalizedMessage.replace(/\n/g, '<br>')}</p>`
              });
              results.email = true;
            }
            break;
          
          case 'push':
            if (user && user.fcmToken) {
              await sendPushNotification(user.fcmToken, {
                title: 'Rent Payment Reminder',
                body: personalizedMessage.substring(0, 100) + (personalizedMessage.length > 100 ? '...' : ''),
                data: {
                  type: 'rent_reminder',
                  studentId: student._id.toString(),
                  amount: totalDue
                }
              });
              results.push = true;
            }
            break;
        }
      } catch (channelError) {
        console.error(`Error sending ${channel}:`, channelError);
      }
    }

    const successfulChannels = channels.filter(c => results[c]);
    
    if (successfulChannels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to send via any selected channel'
      });
    }

    await student.addReminder({
      message: personalizedMessage,
      channels: successfulChannels,
      amount: totalDue,
      status: 'sent',
      sentBy: req.user?._id || null
    });

    res.json({
      success: true,
      message: 'Reminder sent successfully',
      data: {
        channelsSent: successfulChannels,
        sentAt: new Date()
      }
    });

  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reminder',
      error: error.message
    });
  }
});

// =======================
// 📬 Send Bulk Reminders
// POST /api/students/reminders/bulk
// =======================
router.post("/reminders/bulk", async (req, res) => {
  try {
    const { tenantIds, message, channels } = req.body;

    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tenant IDs array is required'
      });
    }

    if (!message || !channels || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message and at least one channel are required'
      });
    }

    const students = await Student.find({
      _id: { $in: tenantIds.map(id => new mongoose.Types.ObjectId(id)) },
      status: 'active'
    })
    .populate('userId', 'name email phone fcmToken')
    .populate('hostelId', 'name')
    .populate('room', 'roomNumber');

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    for (const student of students) {
      try {
        const user = student.userId;
        const totalDue = (student.monthlyRent || 0) + (student.pendingAmount || 0);
        
        const personalizedMessage = message
          .replace(/{name}/g, student.name)
          .replace(/{amount}/g, `₹${totalDue.toLocaleString()}`)
          .replace(/{hostel}/g, student.hostelId?.name || 'Hostel')
          .replace(/{room}/g, student.roomNumber || student.room?.roomNumber || 'N/A')
          .replace(/{dueDate}/g, student.nextPaymentDate ? new Date(student.nextPaymentDate).toLocaleDateString('en-IN') : 'N/A');

        const channelResults = [];

        for (const channel of channels) {
          try {
            switch (channel) {
              case 'sms':
                if (user && user.phone) {
                  await sendSMS(user.phone, personalizedMessage);
                  channelResults.push('sms');
                }
                break;
              
              case 'email':
                if (user && user.email) {
                  await sendEmail({
                    to: user.email,
                    subject: `Rent Payment Reminder - ${student.hostelId?.name || 'Hostel'}`,
                    text: personalizedMessage,
                    html: `<p>${personalizedMessage.replace(/\n/g, '<br>')}</p>`
                  });
                  channelResults.push('email');
                }
                break;
              
              case 'push':
                if (user && user.fcmToken) {
                  await sendPushNotification(user.fcmToken, {
                    title: 'Rent Payment Reminder',
                    body: personalizedMessage.substring(0, 100) + '...',
                    data: {
                      type: 'rent_reminder',
                      studentId: student._id.toString(),
                      amount: totalDue
                    }
                  });
                  channelResults.push('push');
                }
                break;
            }
          } catch (channelError) {
            console.error(`Error sending ${channel} to ${student._id}:`, channelError);
          }
        }

        if (channelResults.length > 0) {
          await student.addReminder({
            message: personalizedMessage,
            channels: channelResults,
            amount: totalDue,
            status: 'sent',
            sentBy: req.user?._id || null
          });

          successCount++;
          results.push({
            studentId: student._id,
            name: student.name,
            status: 'success',
            channels: channelResults
          });
        } else {
          failedCount++;
          results.push({
            studentId: student._id,
            name: student.name,
            status: 'failed',
            error: 'No channels available'
          });
        }

      } catch (studentError) {
        console.error(`Error processing student ${student._id}:`, studentError);
        failedCount++;
        results.push({
          studentId: student._id,
          name: student.name,
          status: 'failed',
          error: studentError.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk reminders: ${successCount} sent, ${failedCount} failed`,
      data: {
        successCount,
        failedCount,
        totalProcessed: students.length,
        results
      }
    });

  } catch (error) {
    console.error('Bulk reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk reminders',
      error: error.message
    });
  }
});

// =======================
// 📜 Get Reminder History for a Tenant
// GET /api/students/:id/reminders
// =======================
router.get("/:id/reminders", async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id)
      .populate('remindersSent.sentBy', 'name');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const reminders = (student.remindersSent || [])
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
      .map(r => ({
        _id: r._id || r.sentAt.getTime().toString(),
        message: r.message,
        channels: r.channels,
        status: r.status,
        amount: r.amount,
        sentAt: r.sentAt,
        sentBy: r.sentBy ? r.sentBy.name : 'System'
      }));

    res.json({
      success: true,
      data: {
        reminders: reminders
      }
    });

  } catch (error) {
    console.error('Get reminder history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder history',
      error: error.message
    });
  }
});

// =======================
// 📊 Get Tenant Statistics
// GET /api/students/stats?hostelId=xxx
// =======================
router.get("/stats", async (req, res) => {
  try {
    const { hostelId } = req.query;

    let matchQuery = { status: 'active' };
    if (hostelId) {
      matchQuery.hostelId = new mongoose.Types.ObjectId(hostelId);
    }

    const stats = await Student.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalTenants: { $sum: 1 },
          totalMonthlyRent: { $sum: { $ifNull: ["$monthlyRent", 0] } },
          totalPendingAmount: { $sum: { $ifNull: ["$pendingAmount", 0] } },
          avgReminderCount: { $avg: { $ifNull: ["$reminderCount", 0] } }
        }
      }
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueQuery = {
      ...matchQuery,
      nextPaymentDate: { $lt: today }
    };

    const overdueStats = await Student.aggregate([
      { $match: overdueQuery },
      {
        $group: {
          _id: null,
          overdueCount: { $sum: 1 },
          totalOverdueAmount: { 
            $sum: { 
              $add: [
                { $ifNull: ["$monthlyRent", 0] },
                { $ifNull: ["$pendingAmount", 0] }
              ]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalTenants: stats[0]?.totalTenants || 0,
        totalMonthlyRent: stats[0]?.totalMonthlyRent || 0,
        totalPendingAmount: stats[0]?.totalPendingAmount || 0,
        averageRemindersPerTenant: Math.round(stats[0]?.avgReminderCount || 0),
        overdueCount: overdueStats[0]?.overdueCount || 0,
        totalOverdueAmount: overdueStats[0]?.totalOverdueAmount || 0
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// =======================
// 🔧 Helper Functions (Placeholder - Implement with your providers)
// =======================

async function sendSMS(phone, message) {
  console.log(`📱 SMS to ${phone}: ${message.substring(0, 50)}...`);
  // TODO: Implement with Twilio, AWS SNS, Fast2SMS, etc.
  return true;
}

async function sendEmail({ to, subject, text, html }) {
  console.log(`📧 Email to ${to}: ${subject}`);
  // TODO: Implement with nodemailer, SendGrid, AWS SES, etc.
  return true;
}

async function sendPushNotification(fcmToken, { title, body, data }) {
  console.log(`🔔 Push to ${fcmToken.substring(0, 20)}...: ${title}`);
  // TODO: Implement with Firebase Cloud Messaging
  return true;
}

module.exports = router;