const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// ตัวแปรเก็บ conversation_id ของ Dify แยกตาม LINE User ID ชั่วคราว
const userConversations = {};

// Webhook endpoint สำหรับรับข้อความจาก LINE
app.post('/webhook', async (req, res) => {
    // ตอบกลับ LINE ทันทีด้วย 200 OK เพื่อป้องกัน LINE ตัด Timeout
    res.status(200).send('OK');

    const events = req.body.events;
    if (!events || events.length === 0) return;

    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const userMessage = event.message.text;
            const replyToken = event.replyToken;
            const userId = event.source.userId;

            try {
                // ดึง conversation_id ล่าสุดของผู้ใช้คนนี้ (ถ้ามี)
                const conversationId = userConversations[userId] || '';

                // 1. ส่งข้อความไปประมวลผลที่ Dify API
                const difyResponse = await axios.post(
                    'https://api.dify.ai/v1/chat-messages',
                    {
                        inputs: {},
                        query: userMessage,
                        response_mode: 'blocking',
                        conversation_id: conversationId,
                        user: userId
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 25000 // กำหนด Timeout 25 วินาที
                    }
                );

                // บันทึก conversation_id ที่ได้จาก Dify ไว้ใช้คุยต่อเนื่อง
                if (difyResponse.data && difyResponse.data.conversation_id) {
                    userConversations[userId] = difyResponse.data.conversation_id;
                }

                // ดึงคำตอบจาก Dify
                const botReply = difyResponse.data.answer || 'ขออภัยค่ะ ไม่พบข้อมูลที่สอบถาม';

                // 2. ส่งข้อความคำตอบกลับไปยัง LINE
                await axios.post(
                    'https://api.line.me/v2/bot/message/reply',
                    {
                        replyToken: replyToken,
                        messages: [
                            {
                                type: 'text',
                                text: botReply
                            }
                        ]
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

            } catch (error) {
                console.error('Error handling message:', error.response ? error.response.data : error.message);
                
                // แจ้งเตือนข้อผิดพลาดกลับไปยัง LINE ผู้ใช้
                try {
                    await axios.post(
                        'https://api.line.me/v2/bot/message/reply',
                        {
                            replyToken: replyToken,
                            messages: [
                                {
                                    type: 'text',
                                    text: 'ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งนะคะ'
                                }
                            ]
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                } catch (replyError) {
                    console.error('Error sending fallback reply:', replyError.message);
                }
            }
        }
    }
});

// ตรวจสอบสถานะ Server ทั่วไป
app.get('/', (req, res) => {
    res.send('MBS Dify Line Bot is running live!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
