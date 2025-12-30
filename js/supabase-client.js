// Supabase 클라이언트 초기화

const SupabaseClient = {
  client: null,
  
  // 초기화
  init() {
    if (this.client) return this.client;
    
    try {
      this.client = supabase.createClient(
        window.CONFIG.SUPABASE_URL,
        window.CONFIG.SUPABASE_ANON_KEY
      );
      
      console.log('Supabase client initialized');
      return this.client;
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      Utils.handleError(error, 'Supabase 연결에 실패했습니다.');
      return null;
    }
  },
  
  // 인스턴스 가져오기
  getInstance() {
    if (!this.client) {
      return this.init();
    }
    return this.client;
  }
};

// Database 작업 모음
const DB = {
  // 사용자 관련
  users: {
    // 사용자 조회 (ID)
    async getById(userId) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 사용자 조회 (이메일)
    async getByEmail(email) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 사용자 조회 (username) - 학생용
    async getByUsername(username) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 사용자 생성
    async create(userData) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('users')
        .insert(userData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 사용자 업데이트
    async update(userId, updates) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 선생님의 학생 목록 조회
    async getStudentsByTeacher(teacherId) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('users')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('role', 'student')
        .order('name');
      
      if (error) throw error;
      return data;
    },
    
    // 사용자 삭제
    async delete(userId) {
      const { error } = await SupabaseClient.getInstance()
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      return true;
    }
  },
  
  // 과목 관련
  subjects: {
    // 선생님의 과목 목록 조회
    async getByTeacher(teacherId) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('subjects')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('order_num');
      
      if (error) throw error;
      return data;
    },
    
    // 과목 생성
    async create(subjectData) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('subjects')
        .insert(subjectData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 과목 업데이트
    async update(subjectId, updates) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('subjects')
        .update(updates)
        .eq('id', subjectId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 과목 삭제
    async delete(subjectId) {
      const { error } = await SupabaseClient.getInstance()
        .from('subjects')
        .delete()
        .eq('id', subjectId);
      
      if (error) throw error;
      return true;
    },
    
    // 과목 조회 (ID)
    async getById(subjectId) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .single();
      
      if (error) throw error;
      return data;
    }
  },
  
  // 퀴즈 관련
  quizzes: {
    // 과목의 퀴즈 목록 조회
    async getBySubject(subjectId, status = null) {
      let query = SupabaseClient.getInstance()
        .from('quizzes')
        .select('*')
        .eq('subject_id', subjectId);
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    
    // 퀴즈 생성
    async create(quizData) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('quizzes')
        .insert(quizData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 퀴즈 업데이트
    async update(quizId, updates) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('quizzes')
        .update(updates)
        .eq('id', quizId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 퀴즈 조회 (ID)
    async getById(quizId) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 퀴즈 삭제
    async delete(quizId) {
      const { error } = await SupabaseClient.getInstance()
        .from('quizzes')
        .delete()
        .eq('id', quizId);
      
      if (error) throw error;
      return true;
    },
    
    // 선생님의 모든 퀴즈 조회
    async getByTeacher(teacherId) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('quizzes')
        .select('*, subjects(*)')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  },
  
  // 제출 관련
  submissions: {
    // 제출 생성
    async create(submissionData) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('submissions')
        .insert(submissionData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 제출 생성 또는 업데이트
    async upsert(submissionData) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('submissions')
        .upsert(submissionData, {
          onConflict: 'quiz_id,student_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // 퀴즈의 모든 제출 조회
    async getByQuiz(quizId) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('submissions')
        .select('*, users(name, username)')
        .eq('quiz_id', quizId)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    
    // 학생의 제출 조회
    async getByStudent(studentId, subjectId = null) {
      let query = SupabaseClient.getInstance()
        .from('submissions')
        .select('*, quizzes(title, status)')
        .eq('student_id', studentId);
      
      if (subjectId) {
        query = query.eq('subject_id', subjectId);
      }
      
      const { data, error } = await query.order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    
    // 특정 제출 조회
    async get(quizId, studentId) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('submissions')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', studentId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = 결과 없음
      return data;
    },
    
    // 제출 업데이트
    async update(submissionId, updates) {
      const { data, error } = await SupabaseClient.getInstance()
        .from('submissions')
        .update(updates)
        .eq('id', submissionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },
  
  // Storage 관련
  storage: {
    // 파일 업로드
    async upload(bucket, path, file) {
      const { data, error } = await SupabaseClient.getInstance()
        .storage
        .from(bucket)
        .upload(path, file);
      
      if (error) throw error;
      
      // 공개 URL 가져오기
      const { data: { publicUrl } } = SupabaseClient.getInstance()
        .storage
        .from(bucket)
        .getPublicUrl(path);
      
      return { path: data.path, url: publicUrl };
    },
    
    // 파일 삭제
    async delete(bucket, path) {
      const { error } = await SupabaseClient.getInstance()
        .storage
        .from(bucket)
        .remove([path]);
      
      if (error) throw error;
      return true;
    },
    
    // 파일 URL 가져오기
    getPublicUrl(bucket, path) {
      const { data } = SupabaseClient.getInstance()
        .storage
        .from(bucket)
        .getPublicUrl(path);
      
      return data.publicUrl;
    }
  },
  
  // Realtime 구독
  realtime: {
    // 제출 실시간 구독
    subscribeToSubmissions(quizId, callback) {
      return SupabaseClient.getInstance()
        .channel(`submissions:${quizId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'submissions',
            filter: `quiz_id=eq.${quizId}`
          },
          callback
        )
        .subscribe();
    },
    
    // 구독 취소
    unsubscribe(subscription) {
      return SupabaseClient.getInstance().removeChannel(subscription);
    }
  }
};

// 전역으로 export
window.SupabaseClient = SupabaseClient;
window.DB = DB;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  SupabaseClient.init();
});
