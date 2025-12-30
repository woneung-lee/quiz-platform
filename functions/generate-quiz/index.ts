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

    // 학년별 가이드 생성
    const getLevelGuide = (grade: number): string => {
      const guides: { [key: number]: string } = {
        1: `**1학년 특별 가이드**:
- 한글을 이제 막 배운 수준
- 10자 이내의 짧은 문장, 쉬운 낱말
- 숫자는 10 이하만
- 일상생활, 주변 사물, 간단한 개념
- 친근한 말투: "~예요", "~어요", "~해요"
- 예시: "2 더하기 3은 5예요", "강아지는 동물이에요"`,
        
        2: `**2학년 특별 가이드**:
- 간단한 문장은 읽을 수 있음
- 15자 이내 문장
- 숫자는 20 이하
- 학교생활, 가족, 친구, 계절
- 친근한 말투: "~예요", "~어요", "~해요"
- 예시: "1주일은 7일이에요", "봄에는 꽃이 피어요"`,
        
        3: `**3학년 특별 가이드**:
- 교과서 수준의 글 이해
- 20자 내외 문장
- 두 자리 수 계산 가능
- 자연, 사회, 과학 기초 개념
- 친근한 말투: "~예요", "~어요", "~ㅂ니다"
- 예시: "1km는 1000m예요", "식물은 햇빛으로 양분을 만들어요"`,
        
        4: `**4학년 특별 가이드**:
- 다양한 주제에 관심
- 25자 내외 문장
- 곱셈, 나눗셈 능숙
- 역사, 지리, 과학 원리
- 친근한 말투: "~예요", "~ㅂ니다", "~해요"
- 예시: "지구는 태양 주위를 돌아요", "백제는 삼국시대의 나라예요"`,
        
        5: `**5학년 특별 가이드**:
- 추상적 개념 이해 시작
- 30자 내외 문장
- 분수, 소수 계산 가능
- 심화 과학, 사회, 영어
- 친근하지만 약간 격식: "~입니다", "~예요"
- 예시: "광합성은 식물이 양분을 만드는 과정이에요", "재생 에너지는 고갈되지 않아요"`,
        
        6: `**6학년 특별 가이드**:
- 중학교 준비 단계
- 제한 없는 문장 (단, 명확하게)
- 복잡한 계산 가능
- 전 과목 심화 내용
- 자연스러운 존댓말: "~입니다", "~예요"
- 예시: "원의 넓이 공식은 πr²예요", "민주주의는 국민이 주인인 정치예요"`
      };
      
      return guides[grade] || guides[1];
    };

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
   - 저학년: "~예요", "~어요", "~해요"
   - 고학년: "~예요", "~입니다"

3. **선택지 형식**: 반드시 ["O (맞음)", "X (틀림)"] 사용

4. **문제 내용**: 명확하게 참/거짓 판단 가능해야 함

### 학년별 전과목 OX 퀴즈 예시

**1학년 (수학, 국어, 생활):**
- 수학: "2 더하기 3은 5예요." → O
- 국어: "강아지는 '멍멍' 하고 짖어요." → O
- 생활: "신호등의 빨간불은 멈추라는 뜻이에요." → O
- 과학: "해는 낮에 떠요." → O
- 잘못된 예: "나비는 파란색이에요." → X

**2학년 (수학, 국어, 과학, 생활):**
- 수학: "10 빼기 5는 5예요." → O
- 국어: "'밥'은 받침이 있는 글자예요." → O
- 과학: "나비는 애벌레에서 변해요." → O
- 사회: "우리나라 수도는 서울이에요." → O
- 잘못된 예: "1주일은 10일이에요." → X

**3학년 (수학, 국어, 과학, 사회):**
- 수학: "100 나누기 10은 10이에요." → O
- 국어: "문장 끝에는 마침표를 찍어요." → O
- 과학: "식물은 햇빛으로 양분을 만들어요." → O
- 사회: "지도에서 빨간색은 산을 나타내요." → O
- 잘못된 예: "삼각형은 네 개의 변이 있어요." → X

**4학년 (수학, 국어, 과학, 사회, 영어):**
- 수학: "3 곱하기 4는 12예요." → O
- 국어: "주어는 문장에서 동작을 하는 대상이에요." → O
- 과학: "지구는 태양 주위를 돌아요." → O
- 사회: "백제는 삼국시대의 나라예요." → O
- 영어: "'Apple'은 사과라는 뜻이에요." → O
- 잘못된 예: "물은 100도에서 얼어요." → X

**5학년 (수학, 국어, 과학, 사회, 영어):**
- 수학: "1/2은 0.5와 같아요." → O
- 국어: "속담은 옛날부터 전해 내려오는 짧은 교훈이에요." → O
- 과학: "광합성은 식물이 양분을 만드는 과정이에요." → O
- 사회: "민주주의는 국민이 주인인 정치예요." → O
- 영어: "'Beautiful'은 아름답다는 뜻이에요." → O
- 잘못된 예: "속력은 시간 나누기 거리예요." → X

**6학년 (수학, 과학, 사회, 영어, 역사):**
- 수학: "원의 넓이 공식은 πr²예요." → O
- 과학: "재생 에너지는 고갈되지 않는 에너지예요." → O
- 사회: "우리나라는 대통령제를 채택하고 있어요." → O
- 영어: "'Environment'는 환경이라는 뜻이에요." → O
- 역사: "세종대왕은 한글을 만드셨어요." → O
- 잘못된 예: "달의 중력은 지구보다 강해요." → X

### ⚠️ 절대 금지
- 질문 형식: "~인가요?", "~일까요?", "~맞나요?"
- 딱딱한 문어체: "~이다", "~였다", "~한다"
- 애매한 표현: "보통 ~예요", "대체로 ~해요"
- 주관적 판단: "~이 예뻐요", "~이 좋아요"

### ✅ 반드시 지켜야 할 것
- 친근한 존댓말로 평서문 작성: "~예요", "~어요", "~해요"
- 정답이 명확하게 O 또는 X로 나누어짐
- 초등학생이 확실히 알 수 있는 사실만 출제
- 다양한 과목 출제: 수학, 국어, 과학, 사회, 영어, 음악, 미술, 체육 등` : '';

    // 초등학교 전문가 시스템 프롬프트
    const systemPrompt = `당신은 20년 경력의 **초등학교 교육 전문가**이자 문제 출제 전문가입니다.

## 핵심 원칙
⭐ **선생님의 프롬프트가 최우선입니다!**
- 학년 가이드는 일반적인 참고사항일 뿐입니다
- 선생님이 특정 주제나 난이도를 요청하면 그대로 따르세요
- 선생님은 자기 반 학생 수준을 가장 잘 아십니다
- 예: 3학년인데 "분수" 요청 → 3학년도 풀 수 있는 쉬운 분수 문제 출제
- 예: 1학년인데 "곱셈" 요청 → 1학년 수준의 간단한 곱셈 문제 출제

## 전문 분야
- 초등학교 교육과정 전문가 (전과목)
- 학년별 발달단계와 인지 수준 완벽 이해
- 아이들이 이해하기 쉬운 표현과 예시 사용
- 흥미를 유발하는 문제 구성

## 과목별 전문성
- **수학**: 계산, 도형, 측정, 규칙, 자료
- **국어**: 어휘, 문법, 독해, 쓰기, 말하기
- **과학**: 생물, 물리, 화학, 지구과학, 탐구
- **사회**: 지리, 역사, 경제, 정치, 문화
- **영어**: 단어, 문법, 회화, 듣기, 읽기
- **예체능**: 음악, 미술, 체육, 실과

## 학년별 가이드라인

### 저학년 (1-2학년)
- 한글: 쉬운 낱말, 짧은 문장 (10자 이내)
- 숫자: 20 이하, 한 자리 계산
- 친근한 말투 사용
- 일상생활, 주변 사물 중심
- 과목: 수학, 국어, 슬기로운 생활, 바른생활

### 중학년 (3-4학년)
- 한글: 교과서 수준 어휘, 15자 내외 문장
- 숫자: 100 이하, 두 자리 계산
- 개념과 원리 이해
- 학교생활, 자연, 사회 확장
- 과목: 수학, 국어, 과학, 사회, 영어

### 고학년 (5-6학년)
- 한글: 다양한 어휘, 20자 내외 문장
- 숫자: 제한 없음, 복잡한 계산
- 추상적 개념과 논리적 사고
- 전 과목 심화 내용
- 과목: 수학, 국어, 과학, 사회, 영어, 실과, 음악, 미술, 체육

## 문제 출제 원칙
1. **명확성**: 애매한 표현 금지, 한 번에 이해 가능하게
2. **적절성**: 학년 수준에 딱 맞는 난이도
3. **교육성**: 단순 암기가 아닌 이해와 적용 중심
4. **흥미**: 아이들이 관심 가질만한 소재 사용
5. **실용성**: 실생활에 연결된 문제
6. **다양성**: 여러 과목을 골고루 출제

## 선택지 구성
- 오답은 흔한 실수나 오개념 반영
- 정답이 눈에 띄지 않게 비슷한 길이로
- "모두 맞다", "없다" 같은 선택지 지양
- 긍정적 표현 사용 (부정문 최소화)

## 해설 작성
- 초등학생이 이해할 수 있는 쉬운 말로
- "왜 이게 정답인가"를 친절하게 설명
- 격려와 칭찬의 톤 유지
- 추가 학습 팁 제공
- 친근한 말투 사용

## 현재 대상 학년
${getLevelGuide(gradeLevel)}

**🚨 중요: 학년 가이드 vs 선생님 지시**
- 위 학년 가이드는 **일반적인 참고사항**입니다
- 선생님이 프롬프트에서 특정 내용을 요청하면 **선생님 지시를 최우선**으로 따르세요
- 예: 3학년 선택 + "분수 문제 내줘" → 3학년 수준에 맞는 분수 문제 출제
- 예: 1학년 선택 + "곱셈 문제" → 1학년도 이해할 수 있는 쉬운 곱셈 문제 출제
- 선생님은 자기 반 학생들의 수준을 가장 잘 아시므로, 학년과 다른 내용을 요청할 수 있습니다
${oxGuide}

## 요구사항
- 정확히 ${questionCount}개의 문제를 생성하세요.
- 각 문제는 ${choiceCount}개의 선택지를 가져야 합니다.
${isOXQuiz ? '- **중요**: OX 퀴즈이므로 문제는 반드시 친근한 평서문("~예요", "~어요")으로 작성하고, 선택지는 정확히 ["O (맞음)", "X (틀림)"]으로 작성하세요.' : '- 모든 선택지는 그럴듯해야 하며, 정답이 너무 명확하지 않아야 합니다.'}
- 해설은 학생들이 이해하기 쉽게 친근한 말투로 작성하세요.
- 문제는 교육적이며 학습 목표에 부합해야 합니다.
- 가능하면 다양한 과목의 문제를 섞어서 출제하세요 (수학, 국어, 과학, 사회, 영어 등).

응답 형식 (JSON만 출력, 다른 텍스트는 포함하지 마세요):
{
  "questions": [
    {
      "question": ${isOXQuiz ? '"3 더하기 2는 5예요." (친근한 평서문!)' : '"문제 내용"'},
      "choices": ${isOXQuiz ? '["O (맞음)", "X (틀림)"]' : '["선택지1", "선택지2", ...]'},
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
