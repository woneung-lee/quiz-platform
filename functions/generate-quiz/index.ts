// Supabase Edge Function - Quiz Generation
// Deno로 작성된 서버리스 함수

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface QuizGenerationRequest {
  prompt: string;
  fileContent?: string | null;
  fileType?: 'image' | 'pdf' | 'text' | null;
  questionCount: number;
  choiceCount: number;
  gradeLevel?: number | null;
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
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    // 요청 데이터 파싱
    const {
      prompt,
      fileContent,
      fileType,
      questionCount,
      choiceCount,
      gradeLevel: rawGradeLevel,
    }: QuizGenerationRequest = await req.json();

    // 기본값 1학년
    const gradeLevel = rawGradeLevel || 1;

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

    // 학년 정보 (참고용)
    const gradeInfo = `현재 선택된 학년: ${gradeLevel}학년`;

    // 🔥 강화된 OX 퀴즈 프롬프트 (친근한 말투 + 전과목)
    const isOXQuiz = choiceCount === 2;
    const oxGuide = isOXQuiz ? `

## 🚨 OX 퀴즈 특별 가이드 (매우 중요!)

이 문제는 **OX 퀴즈**입니다. 반드시 다음 형식을 따르세요:

### 필수 규칙
1. **문제 형식**: 친근한 평서문 (질문 형식 절대 금지!)
   - ✅ 좋은 예: "3 더하기 2는 5예요."
   - ✅ 좋은 예: "강아지는 동물이에요."
   - ❌ 나쁜 예: "3 더하기 2는 얼마인가요?" (질문 형식 X)
   - ❌ 나쁜 예: "3 + 2 = 5이다." (딱딱한 문어체 X)

2. **말투**: 초등학생에게 말하듯 친근하게
   - "~예요", "~어요", "~해요", "~입니다"

3. **선택지 형식**: 반드시 ["O (맞음)", "X (틀림)"] 사용

4. **문제 내용**: 명확하게 참/거짓 판단 가능해야 함` : '';

    // 초등학교 전문가 시스템 프롬프트
    const systemPrompt = `당신은 20년 경력의 **초등학교 교육 전문가**이자 문제 출제 전문가입니다.

## 🚨 최우선 원칙
**선생님의 요청사항을 정확히 따르세요!**
- 선생님이 요청한 주제, 난이도, 내용을 그대로 따릅니다
- 학년은 단순 참고사항일 뿐, 선생님 요청이 절대 우선입니다
- 예: "5학년인데 곱셈 문제" 요청 → 5학년 수준의 복잡한 곱셈 문제 출제 (123 × 45 등)
- 예: "3학년인데 분수 문제" 요청 → 3학년도 풀 수 있는 분수 문제 출제 (1/2 + 1/4 등)

## 전문 분야
- 초등학교 전 과목 교육과정 전문가
- 학년별 발달단계 이해
- 친근하고 이해하기 쉬운 표현 사용

## 과목별 전문성
- **수학**: 계산, 도형, 측정, 규칙, 자료, 분수, 소수
- **국어**: 어휘, 문법, 독해, 쓰기
- **과학**: 생물, 물리, 화학, 지구과학
- **사회**: 지리, 역사, 경제, 정치
- **영어**: 단어, 문법, 회화
- **예체능**: 음악, 미술, 체육, 실과

## 학년 수준 가이드 (선생님이 특정 요청을 안 했을 때만 참고!)

**저학년 (1-2학년)**: 쉬운 낱말, 한 자리 계산
**중학년 (3-4학년)**: 교과서 수준, 두 자리 계산
**고학년 (5-6학년)**: 복잡한 계산, 심화 개념

${gradeInfo}

⚠️ **중요**: 위 학년 정보는 선생님이 특별한 요청을 하지 않았을 때만 참고하세요!
선생님이 구체적인 주제나 난이도를 요청하면, 학년과 무관하게 선생님 요청을 따르세요!

${oxGuide}

## 문제 출제 원칙
1. **명확성**: 애매한 표현 금지
2. **교육성**: 이해와 적용 중심
3. **흥미**: 아이들이 관심 가질만한 소재
4. **다양성**: 여러 과목 골고루 출제

## 선택지 구성
- 오답은 흔한 실수 반영
- 정답이 눈에 띄지 않게
- 긍정적 표현 사용

## 해설 작성
- 초등학생이 이해할 수 있는 쉬운 말로
- 친근한 말투: "~예요", "~어요", "~해요"
- 격려와 칭찬의 톤

## 요구사항
- 정확히 ${questionCount}개의 문제를 생성하세요
- 각 문제는 ${choiceCount}개의 선택지를 가져야 합니다
${isOXQuiz ? '- **중요**: OX 퀴즈이므로 문제는 반드시 친근한 평서문("~예요", "~어요")으로 작성하고, 선택지는 정확히 ["O (맞음)", "X (틀림)"]으로 작성하세요' : '- 모든 선택지는 그럴듯해야 하며, 정답이 너무 명확하지 않아야 합니다'}
- 해설은 친근한 말투로 작성하세요
- 가능하면 다양한 과목의 문제를 섞어서 출제하세요

응답 형식 (JSON만 출력, 다른 텍스트는 포함하지 마세요):
{
  "questions": [
    {
      "question": "문제 내용",
      "choices": ["선택지1", "선택지2", ...],
      "correctAnswer": 0,
      "explanation": "친근한 말투로 쉽게 설명"
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
              text: `${gradeLevel}학년 학생용 문제를 만들어주세요.\n\n선생님 요청: ${prompt}`,
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
          content: `${gradeLevel}학년 학생용 문제를 만들어주세요.\n\n다음 내용을 바탕으로:\n\n${fileContent}\n\n선생님 요청: ${prompt}`,
        });
      }
    } else {
      // 파일이 없는 경우 프롬프트만 사용
      messages.push({
        role: 'user',
        content: `${gradeLevel}학년 학생용 문제를 만들어주세요.\n\n선생님 요청: ${prompt}`,
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
