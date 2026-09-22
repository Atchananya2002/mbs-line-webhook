const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

// ดึงค่า Config จาก Environment Variables บน Render
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

// Route สำหรับตรวจสอบว่า Server ทำงานปกติหรือไม่ (และใช้ให้ UptimeRobot ยิงเช็ก)
app.get('/', (req, res) => {
  res.send('MBS Chatbot Webhook is running!');
});

// Webhook Route: ตอบกลับ LINE ทันที (200 OK) เพื่อตัดปัญหา Timeout
app.post('/webhook', line.middleware(config), (req, res) => {
  res.status(200).end();
  req.body.events.forEach(handleEvent);
});

async function handleEvent(event) {
  // กรองรับเฉพาะข้อความที่เป็นข้อความตัวอักษร (Text Message)
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const userId = event.source.userId;
  const userMessage = event.message.text;

  try {
    // ส่งข้อความไปยัง Flowise API
    const response = await axios.post(
      'https://cloud.flowiseai.com/api/v1/prediction/03c3c359-dc24-4ae1-9477-11c6070f5cad',
      {
        question: userMessage,
        overrideConfig: {
          sessionId: userId
        }
      },
      { timeout: 120000 } // ให้เวลารอค้นหาข้อมูลได้สูงสุด 2 นาที
    );

    // ดึงคำตอบจาก Flowise
    const replyText = response.data.text || response.data;

    // ใช้ pushMessage ส่งคำตอบหาผู้ใช้โดยตรง
    await client.pushMessage(userId, {
      type: 'text',
      text: replyText
    });

  } catch (error) {
    console.error('Flowise API Error:', error.response ? error.response.data : error.message);
    await client.pushMessage(userId, {
      type: 'text',
      text: 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง'
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
