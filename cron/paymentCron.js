const cron = require('node-cron');
const Payment = require('../models/paymentSchema');

// ⏰ Run every day at 12:00 AM
cron.schedule('56 10 * * *', async () => {
  console.log('🔄 Running Payment Overdue Cron...');

  try {
    const result = await Payment.updateMany(
      {
        paymentStatus: 'pending',
        dueDate: { $lt: new Date() }
      },
      {
        $set: { paymentStatus: 'overdue' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} payments to overdue`);
  } catch (error) {
    console.error('❌ Cron Error:', error.message);
  }
});