const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

// ดึงค่า Config จาก Environment Variables บน Render เพื่อความปลอดภัย
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

// Route สำหรับตรวจสอบว่า Server ทำงานปกติหรือไม่
app.get('/', (req, res) => {
  res.send('MBS Chatbot Webhook is running!');
});

// Webhook Route สำหรับรับ Event จาก LINE
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('Webhook Error:', err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  // กรองรับเฉพาะข้อความที่เป็นข้อความตัวอักษร (Text Message)
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userId = event.source.userId; // ใช้ LINE User ID เป็น Session ID เพื่อให้ AI จำการสนทนาของแต่ละคนได้
  const userMessage = event.message.text;

  try {
    // ส่งข้อความไปยัง Flowise API (Chatflow ID: 03c3c359-dc24-4ae1-9477-11c6070f5cad)
    const response = await axios.post(
      'https://cloud.flowiseai.com/api/v1/prediction/03c3c359-dc24-4ae1-9477-11c6070f5cad',
      {
        question: userMessage,
        overrideConfig: {
          sessionId: userId
        }
      }
    );

    // ดึงคำตอบจาก Flowise
    const replyText = response.data.text || response.data;

    // ส่งข้อความตอบกลับไปยัง LINE
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyText
    });

  } catch (error) {
    console.error('Flowise API Error:', error.response ? error.response.data : error.message);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบฐานข้อมูล กรุณาลองใหม่อีกครั้ง'
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});