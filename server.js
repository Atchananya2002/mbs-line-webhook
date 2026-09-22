// Webhook Route: ตอบรับ LINE ทันทีเพื่อไม่ให้ตัด Connection
app.post('/webhook', line.middleware(config), (req, res) => {
  res.status(200).end(); // แจ้ง LINE ว่าได้รับ Event เรียบร้อยทันที
  req.body.events.forEach(handleEvent);
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const userId = event.source.userId;
  const userMessage = event.message.text;

  try {
    const response = await axios.post(
      'https://cloud.flowiseai.com/api/v1/prediction/03c3c359-dc24-4ae1-9477-11c6070f5cad',
      {
        question: userMessage,
        overrideConfig: {
          sessionId: userId
        }
      },
      { timeout: 120000 } // เพิ่มเวลารอ Flowise สูงสุด 2 นาที
    );

    const replyText = response.data.text || response.data;

    // ใช้ pushMessage ส่งหา userId โดยตรง หมดปัญหาเรื่อง replyToken หมดอายุ
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
