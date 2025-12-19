// Vercel Serverless Function - OpenAI API 호출
// 환경 변수로 API 키를 안전하게 사용합니다

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, fileContent, fileType, questionCount, choiceCount } = req.body;

    // 유효성 검사
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: '프롬프트를 입력해주세요.' });
    }

    if (!questionCount || questionCount < 5 || questionCount > 50) {
      return res.status(400).json({ error: '문제 개수는 5~50개 사이여야 합니다.' });
    }

    if (!choiceCount || choiceCount < 2 || choiceCount > 5) {
      return res.status(400).json({ error: '선택지 개수는 2~5개 사이여야 합니다.' });
    }

    // OpenAI API 호출
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 교육용 퀴즈를 생성하는 전문가입니다. 
요청받은 내용에 맞는 객관식 문제를 생성해주세요.

응답은 반드시 다음 JSON 형식으로만 답변하세요:
{
  "questions": [
    {
      "question": "문제 내용",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correctAnswer": 2,
      "explanation": "정답 해설"
    }
  ]
}

중요 규칙:
- correctAnswer는 0부터 시작하는 인덱스입니다 (0, 1, 2, 3...)
- choices 배열의 개수는 정확히 ${choiceCount}개여야 합니다
- 총 ${questionCount}개의 문제를 생성해야 합니다
- JSON 형식 외에 다른 텍스트는 포함하지 마세요`
          },
          {
            role: 'user',
            content: buildPrompt(prompt, fileContent, fileType, questionCount, choiceCount)
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API Error:', errorData);
      return res.status(500).json({ 
        error: 'OpenAI API 호출 중 오류가 발생했습니다.',
        details: errorData.error?.message 
      });
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0].message.content;

    // JSON 파싱
    let result;
    try {
      // JSON 코드 블록 제거
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Content:', content);
      return res.status(500).json({ 
        error: 'AI 응답을 파싱하는 중 오류가 발생했습니다.',
        details: content 
      });
    }

    // 응답 검증
    if (!result.questions || !Array.isArray(result.questions)) {
      return res.status(500).json({ 
        error: '올바르지 않은 응답 형식입니다.' 
      });
    }

    // 각 문제 검증
    for (let i = 0; i < result.questions.length; i++) {
      const q = result.questions[i];
      
      if (!q.question || !q.choices || !Array.isArray(q.choices)) {
        return res.status(500).json({ 
          error: `${i + 1}번 문제 형식이 올바르지 않습니다.` 
        });
      }

      if (q.correctAnswer === undefined || q.correctAnswer === null) {
        return res.status(500).json({ 
          error: `${i + 1}번 문제의 정답이 설정되지 않았습니다.` 
        });
      }

      if (q.correctAnswer < 0 || q.correctAnswer >= q.choices.length) {
        return res.status(500).json({ 
          error: `${i + 1}번 문제의 정답 인덱스가 올바르지 않습니다.` 
        });
      }
    }

    // 성공 응답
    res.status(200).json(result);

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      details: error.message 
    });
  }
}

// 프롬프트 생성 함수
function buildPrompt(userPrompt, fileContent, fileType, questionCount, choiceCount) {
  let prompt = `다음 요청에 맞는 객관식 문제를 ${questionCount}개 생성해주세요.\n\n`;
  prompt += `요청 내용: ${userPrompt}\n\n`;

  // 파일 내용이 있으면 추가
  if (fileContent) {
    if (fileType === 'text') {
      prompt += `참고 자료:\n${fileContent}\n\n`;
    } else if (fileType === 'image' || fileType === 'pdf') {
      prompt += `이미지/PDF 파일이 제공되었습니다. 내용을 참고하여 문제를 생성해주세요.\n\n`;
    }
  }

  prompt += `각 문제는 ${choiceCount}지선다 형식이어야 합니다.\n`;
  prompt += `정답은 0부터 시작하는 인덱스로 표시해주세요.\n`;
  prompt += `각 문제에는 정답 해설을 포함해주세요.`;

  return prompt;
}
