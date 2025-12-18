// OpenAI API 호출 (Supabase Edge Function 경유)

const OpenAIClient = {
  // 퀴즈 생성
  async generateQuiz(options) {
    try {
      const {
        prompt,
        fileContent = null,
        fileType = null,
        questionCount = window.CONFIG.DEFAULT_QUESTION_COUNT,
        choiceCount = window.CONFIG.DEFAULT_CHOICE_COUNT
      } = options;
      
      // 유효성 검사
      if (!prompt || prompt.trim().length === 0) {
        throw new Error('프롬프트를 입력해주세요.');
      }
      
      if (questionCount < window.CONFIG.MIN_QUESTION_COUNT || 
          questionCount > window.CONFIG.MAX_QUESTION_COUNT) {
        throw new Error(`문제 개수는 ${window.CONFIG.MIN_QUESTION_COUNT}~${window.CONFIG.MAX_QUESTION_COUNT}개 사이여야 합니다.`);
      }
      
      if (choiceCount < window.CONFIG.MIN_CHOICE_COUNT || 
          choiceCount > window.CONFIG.MAX_CHOICE_COUNT) {
        throw new Error(`선택지 개수는 ${window.CONFIG.MIN_CHOICE_COUNT}~${window.CONFIG.MAX_CHOICE_COUNT}개 사이여야 합니다.`);
      }
      
      // Supabase Edge Function 호출
      const { data, error } = await SupabaseClient.getInstance().functions.invoke('generate-quiz', {
        body: {
          prompt,
          fileContent,
          fileType,
          questionCount,
          choiceCount
        }
      });
      
      if (error) throw error;
      
      // 응답 검증
      if (!data || !data.questions || !Array.isArray(data.questions)) {
        throw new Error('올바르지 않은 응답 형식입니다.');
      }
      
      // 문제 개수 확인
      if (data.questions.length !== questionCount) {
        console.warn(`요청한 ${questionCount}개와 다른 ${data.questions.length}개의 문제가 생성되었습니다.`);
      }
      
      // 각 문제 검증
      data.questions.forEach((q, index) => {
        if (!q.question || !q.choices || !Array.isArray(q.choices)) {
          throw new Error(`${index + 1}번 문제 형식이 올바르지 않습니다.`);
        }
        
        if (q.choices.length !== choiceCount) {
          console.warn(`${index + 1}번 문제의 선택지 개수가 ${choiceCount}개가 아닙니다.`);
        }
        
        if (q.correctAnswer === undefined || q.correctAnswer === null) {
          throw new Error(`${index + 1}번 문제의 정답이 설정되지 않았습니다.`);
        }
        
        if (q.correctAnswer < 0 || q.correctAnswer >= q.choices.length) {
          throw new Error(`${index + 1}번 문제의 정답 인덱스가 올바르지 않습니다.`);
        }
      });
      
      return data.questions;
    } catch (error) {
      console.error('Quiz generation error:', error);
      Utils.handleError(error, '문제 생성 중 오류가 발생했습니다.');
      throw error;
    }
  },
  
  // 문제 미리보기 생성 (일부만 생성)
  async generatePreview(options) {
    try {
      // 미리보기는 3문제만 생성
      const questions = await this.generateQuiz({
        ...options,
        questionCount: 3
      });
      
      return questions;
    } catch (error) {
      console.error('Preview generation error:', error);
      throw error;
    }
  },
  
  // 문제 개선 제안
  async improveQuestion(question, choices, feedback) {
    try {
      const prompt = `다음 퀴즈 문제를 개선해주세요:

문제: ${question}
선택지: ${choices.join(', ')}
피드백: ${feedback}

개선된 문제와 선택지를 JSON 형식으로 제공해주세요.
형식: {
  "question": "개선된 문제",
  "choices": ["선택지1", "선택지2", ...]
}`;

      const { data, error } = await SupabaseClient.getInstance().functions.invoke('generate-quiz', {
        body: {
          prompt,
          questionCount: 1,
          choiceCount: choices.length
        }
      });
      
      if (error) throw error;
      
      return data.questions[0];
    } catch (error) {
      console.error('Question improvement error:', error);
      throw error;
    }
  },
  
  // 해설 생성
  async generateExplanation(question, choices, correctAnswer) {
    try {
      const prompt = `다음 문제에 대한 상세한 해설을 작성해주세요:

문제: ${question}
선택지: ${choices.join(', ')}
정답: ${choices[correctAnswer]}

해설은 학생들이 이해하기 쉽도록 작성해주세요.`;

      const { data, error } = await SupabaseClient.getInstance().functions.invoke('generate-quiz', {
        body: {
          prompt,
          questionCount: 1,
          choiceCount: choices.length
        }
      });
      
      if (error) throw error;
      
      return data.questions[0].explanation;
    } catch (error) {
      console.error('Explanation generation error:', error);
      throw error;
    }
  }
};

// 퀴즈 생성 UI 헬퍼
const QuizGeneratorHelper = {
  // 시스템 프롬프트 템플릿
  getSystemPrompt(questionCount, choiceCount) {
    return `당신은 교육용 퀴즈를 생성하는 AI 어시스턴트입니다.

요구사항:
- 정확히 ${questionCount}개의 문제를 생성하세요.
- 각 문제는 ${choiceCount}개의 선택지를 가져야 합니다.
- 모든 선택지는 그럴듯해야 하며, 정답이 너무 명확하지 않아야 합니다.
- 해설은 학생들이 이해하기 쉽게 작성하세요.
- 문제는 교육적이며 학습 목표에 부합해야 합니다.

응답 형식 (JSON):
{
  "questions": [
    {
      "question": "문제 내용",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correctAnswer": 2,
      "explanation": "해설 내용"
    }
  ]
}`;
  },
  
  // 프롬프트 템플릿
  templates: {
    basic: (subject, level, topic) => 
      `${level} ${subject} ${topic}에 대한 문제를 생성해주세요.`,
    
    fromText: (text) => 
      `다음 내용을 바탕으로 문제를 생성해주세요:\n\n${text}`,
    
    fromFile: (fileName) => 
      `첨부된 파일(${fileName})의 내용을 바탕으로 문제를 생성해주세요.`,
    
    vocabulary: (words) => 
      `다음 어휘에 대한 문제를 생성해주세요: ${words.join(', ')}`,
    
    math: (topic, level) => 
      `${level} 수준의 ${topic} 문제를 생성해주세요. 단계별 풀이 과정을 해설에 포함해주세요.`,
    
    science: (topic, concept) => 
      `${topic}의 ${concept}에 대한 문제를 생성해주세요. 과학적 원리를 해설에 설명해주세요.`
  },
  
  // 프롬프트 개선
  enhancePrompt(userPrompt, subject = null, level = null) {
    let enhanced = userPrompt;
    
    // 과목이 명시되지 않은 경우
    if (subject && !userPrompt.includes(subject)) {
      enhanced = `[${subject}] ${enhanced}`;
    }
    
    // 난이도가 명시되지 않은 경우
    if (level && !userPrompt.match(/(초등|중등|고등|대학)/)) {
      enhanced = `${level} 수준의 ${enhanced}`;
    }
    
    // 구체성 추가
    if (!userPrompt.match(/(문제|퀴즈|시험)/)) {
      enhanced += ' 문제를 생성해주세요.';
    }
    
    return enhanced;
  },
  
  // 문제 품질 검증
  validateQuestions(questions) {
    const issues = [];
    
    questions.forEach((q, index) => {
      const num = index + 1;
      
      // 문제 길이 확인
      if (q.question.length < 10) {
        issues.push(`${num}번: 문제가 너무 짧습니다.`);
      }
      
      if (q.question.length > 500) {
        issues.push(`${num}번: 문제가 너무 깁니다.`);
      }
      
      // 선택지 확인
      if (q.choices.some(c => c.length < 1)) {
        issues.push(`${num}번: 빈 선택지가 있습니다.`);
      }
      
      // 중복 선택지 확인
      const uniqueChoices = new Set(q.choices);
      if (uniqueChoices.size !== q.choices.length) {
        issues.push(`${num}번: 중복된 선택지가 있습니다.`);
      }
      
      // 해설 확인
      if (!q.explanation || q.explanation.length < 10) {
        issues.push(`${num}번: 해설이 부족합니다.`);
      }
    });
    
    return {
      isValid: issues.length === 0,
      issues
    };
  },
  
  // 문제 난이도 추정
  estimateDifficulty(question) {
    // 간단한 휴리스틱 기반 난이도 추정
    let score = 0;
    
    // 문제 길이
    if (question.question.length > 100) score += 1;
    if (question.question.length > 200) score += 1;
    
    // 복잡한 단어 포함 여부
    const complexWords = ['따라서', '그러나', '반면', '비교', '분석', '추론'];
    if (complexWords.some(word => question.question.includes(word))) {
      score += 1;
    }
    
    // 숫자/계산 포함 여부
    if (/\d+/.test(question.question)) {
      score += 1;
    }
    
    if (score <= 1) return '쉬움';
    if (score <= 2) return '보통';
    return '어려움';
  }
};

// 전역으로 export
window.OpenAIClient = OpenAIClient;
window.QuizGeneratorHelper = QuizGeneratorHelper;
