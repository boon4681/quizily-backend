## Quizzes API
### Prerequisites
- Set `GEMINI_API_KEY` in .env

.env example
```
DATABASE_URL=""
BETTER_AUTH_SECRET=""
BETTER_AUTH_URL="http://localhost:3000"
GEMINI_API_KEY=""
```

### Generate a quiz (PDF upload)
title กับ description มัน gen ให้เอง เขียนแค่ option ด้านล่างพอ 

### Notes
- เลือกระดับความยากได้ `BEGINNER`, `INTERMEDIATE`, `EXPERT`
- จำนวนคำถามก็ระบุได้ `questionCount`
- input เยอะใช้เวลานานนิดนึง

```
curl -X POST http://localhost:3000/api/quizzes/generate \
  -F "ownerId=..." \
  -F "questionCount=5" \
  -F "difficulty=INTERMEDIATE" \
  -F "file=@C:\\target\file"
```

ถ้าเป็นแบบ raw text ใส่แบบนี้

```
curl -X POST http://localhost:3000/api/quizzes/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ownerId": "...",
    "text": "<your long text>",
    "questionCount": 5,
    "difficulty": "INTERMEDIATE"
  }'
```

### Get a quiz (with answers)
ถ้าอยากได้คำถาม + คำตอบใช้ `includeAnswers=true` ด้านหลัง หรือถ้าไม่มีก็ได้จะได้เป็นคำถามเปล่าๆมา

```
curl "http://localhost:3000/api/quizzes/<QUIZ_ID>?includeAnswers=true"
```

### Update a quiz (title/description)
Owner-only : ถ้าอยากเปลี่ยน title หรือ description

```
curl -X PATCH http://localhost:3000/api/quizzes/<QUIZ_ID> \
  -H "Content-Type: application/json" \
  -d '{
    "ownerId": "<Owner_ID>",
    "title": "New Title",
    "description": "Optional description"
  }'
```

### Delete a quiz
Owner-only : ลบ

```
curl -X DELETE "http://localhost:3000/api/quizzes/<QUIZ_ID>?ownerId=<Owner_ID>"
```
