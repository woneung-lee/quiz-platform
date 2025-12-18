// Supabase Edge Function - Quiz Generation
// Deno로 작성된 서버리스 함수

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuizGenerationRequest {
  prompt: string;
  fileContent?: string | null;
  fileType?: 'image' | 'pdf' | 'text' | null;
  questionCount: number;
  choiceCount: number;
}

interface Question {
  question: string;
  choices: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizResponse {
  questions: Question[];
}

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 요청 데이터 파싱
    const {
      prompt,
      fileContent,
      fileType,
      questionCount,
      choiceCount,
    }: QuizGenerationRequest = await req.json();

    // 유효성 검사
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('프롬프트가 필요합니다.');
    }

    if (questionCount < 1 || questionCount > 50) {
      throw new Error('문제 개수는 1~50개 사이여야 합니다.');
    }

    if (choiceCount < 2 || choiceCount > 5) {
      throw new Error('선택지 개수는 2~5개 사이여야 합니다.');
    }

    // OpenAI API 키 가져오기
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    // 시스템 프롬프트 생성
    const systemPrompt = `당신은 교육용 퀴즈를 생성하는 AI 어시스턴트입니다.

요구사항:
- 정확히 ${questionCount}개의 문제를 생성하세요.
- 각 문제는 ${choiceCount}개의 선택지를 가져야 합니다.
- 모든 선택지는 그럴듯해야 하며, 정답이 너무 명확하지 않아야 합니다.
- 해설은 학생들이 이해하기 쉽게 작성하세요.
- 문제는 교육적이며 학습 목표에 부합해야 합니다.

응답 형식 (JSON만 출력, 다른 텍스트는 포함하지 마세요):
{
  "questions": [
    {
      "question": "문제 내용",
      "choices": ["선택지1", "선택지2", ...],
      "correctAnswer": 0,
      "explanation": "해설 내용"
    }
  ]
}`;

    // 메시지 구성
    const messages: any[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    // 파일이 있는 경우 처리
    if (fileContent && fileType) {
      if (fileType === 'image' || fileType === 'pdf') {
        // 이미지나 PDF는 GPT-4 Vision 사용
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${fileContent}`,
              },
            },
          ],
        });
      } else if (fileType === 'text') {
        // 텍스트 파일은 내용을 직접 포함
        messages.push({
          role: 'user',
          content: `다음 내용을 바탕으로 문제를 생성해주세요:\n\n${fileContent}\n\n${prompt}`,
        });
      }
    } else {
      // 파일이 없는 경우 프롬프트만 사용
      messages.push({
        role: 'user',
        content: prompt,
      });
    }

    // OpenAI API 호출
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: fileType === 'image' || fileType === 'pdf' ? 'gpt-4o-mini' : 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API 오류: ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const openaiData = await openaiResponse.json();
    
    // 응답 파싱
    const content = openaiData.choices[0].message.content;
    let quizData: QuizResponse;

    try {
      quizData = JSON.parse(content);
    } catch (error) {
      console.error('JSON parsing error:', error);
      console.error('Content:', content);
      throw new Error('OpenAI 응답을 파싱할 수 없습니다.');
    }

    // 응답 검증
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error('올바르지 않은 응답 형식입니다.');
    }

    // 각 문제 검증 및 정리
    const validatedQuestions = quizData.questions.map((q, index) => {
      if (!q.question || !q.choices || !Array.isArray(q.choices)) {
        throw new Error(`${index + 1}번 문제 형식이 올바르지 않습니다.`);
      }

      if (q.correctAnswer === undefined || q.correctAnswer === null) {
        throw new Error(`${index + 1}번 문제의 정답이 설정되지 않았습니다.`);
      }

      if (q.correctAnswer < 0 || q.correctAnswer >= q.choices.length) {
        throw new Error(`${index + 1}번 문제의 정답 인덱스가 올바르지 않습니다.`);
      }

      return {
        question: q.question.trim(),
        choices: q.choices.map((c: string) => c.trim()),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation ? q.explanation.trim() : '해설이 제공되지 않았습니다.',
      };
    });

    // 성공 응답
    return new Response(
      JSON.stringify({
        questions: validatedQuestions,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || '문제 생성 중 오류가 발생했습니다.',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
