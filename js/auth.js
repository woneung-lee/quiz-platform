// 인증 시스템

const Auth = {
  currentUser: null,
  
  // 초기화
  async init() {
    await this.loadUser();
    this.setupAuthStateListener();
  },
  
  // 현재 사용자 로드
  async loadUser() {
    try {
      const { data: { session }, error } = await SupabaseClient.getInstance().auth.getSession();
      
      if (error) throw error;
      
      if (session && session.user) {
        const userData = await DB.users.getById(session.user.id);
        this.currentUser = {
          ...session.user,
          ...userData
        };
        
        Utils.storage.set(window.CONFIG.STORAGE_KEYS.USER, this.currentUser);
        
        return this.currentUser;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load user:', error);
      return null;
    }
  },
  
  // 인증 상태 리스너 설정
  setupAuthStateListener() {
    SupabaseClient.getInstance().auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN') {
        await this.loadUser();
        this.onAuthChange('signed_in');
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        Utils.storage.remove(window.CONFIG.STORAGE_KEYS.USER);
        this.onAuthChange('signed_out');
      }
    });
  },
  
  // 인증 변경 이벤트 핸들러
  onAuthChange(event) {
    window.dispatchEvent(new CustomEvent('authChange', { detail: { event, user: this.currentUser } }));
  },
  
  // 아이디/비밀번호 회원가입 (선생님)
  async signUpWithUsername(username, password, name) {
    try {
      // 이메일 형식으로 변환 (내부적으로만 사용)
      const email = `${username}@teachers.local`;
      
      // Supabase Auth 회원가입
      const { data: authData, error: authError } = await SupabaseClient.getInstance().auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            role: 'teacher'
          }
        }
      });
      
      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('사용할 수 없는 아이디입니다. 다른 아이디를 입력해 주세요.');
        }
        throw authError;
      }
      
      // users 테이블에 정보 저장
      const userData = await DB.users.create({
        id: authData.user.id,
        username,
        email,
        role: 'teacher',
        name
      });
      
      this.currentUser = {
        ...authData.user,
        ...userData
      };
      
      Utils.showToast('회원가입이 완료되었습니다!', 'success');
      return this.currentUser;
    } catch (error) {
      console.error('Signup error:', error);
      Utils.handleError(error, error.message || '회원가입에 실패했습니다.');
      throw error;
    }
  },
  
  // 아이디/비밀번호 로그인 (선생님)
  async signInWithUsername(username, password, role = 'teacher') {
    try {
      // 이메일 형식으로 변환
      const email = `${username}@teachers.local`;
      
      const { data, error } = await SupabaseClient.getInstance().auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      await this.loadUser();
      
      if (this.currentUser.role !== role) {
        await this.signOut();
        throw new Error('권한이 없습니다.');
      }
      
      Utils.showToast(`환영합니다, ${this.currentUser.name}님!`, 'success');
      return this.currentUser;
    } catch (error) {
      console.error('Login error:', error);
      Utils.handleError(error, '아이디 또는 비밀번호가 올바르지 않습니다.');
      throw error;
    }
  },
  
  // 학생 로그인 (ID 선택 방식)
  async signInStudent(studentId, password) {
    try {
      // 학생 정보 가져오기
      const student = await DB.users.getById(studentId);
      
      if (!student || student.role !== 'student') {
        throw new Error('학생 정보를 찾을 수 없습니다.');
      }
      
      // 학생은 username@students.local 형식의 이메일 사용
      const email = `${student.username}@students.local`;
      
      const { data, error } = await SupabaseClient.getInstance().auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      await this.loadUser();
      
      Utils.showToast(`환영합니다, ${this.currentUser.name}님!`, 'success');
      return this.currentUser;
    } catch (error) {
      console.error('Student login error:', error);
      Utils.handleError(error, '비밀번호가 올바르지 않습니다.');
      throw error;
    }
  },
  
  // 로그아웃
  async signOut() {
    try {
      const { error } = await SupabaseClient.getInstance().auth.signOut();
      
      if (error) throw error;
      
      this.currentUser = null;
      Utils.storage.remove(window.CONFIG.STORAGE_KEYS.USER);
      
      window.location.href = '/login.html';
    } catch (error) {
      console.error('Signout error:', error);
      Utils.handleError(error, '로그아웃에 실패했습니다.');
      throw error;
    }
  },
  
  // 학생 계정 생성 (선생님이 생성)
  async createStudent(name, studentNumber, password, teacherId) {
    try {
      // username 생성 (student_번호 형식)
      const username = `student_${studentNumber}`;
      const email = `${username}@students.local`;
      
      // Supabase Auth에 계정 생성
      const { data: authData, error: authError } = await SupabaseClient.getInstance().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'student',
          student_number: studentNumber
        }
      });
      
      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('이미 사용중인 번호입니다.');
        }
        throw authError;
      }
      
      // users 테이블에 정보 저장
      const userData = await DB.users.create({
        id: authData.user.id,
        username,
        email,
        role: 'student',
        name,
        teacher_id: teacherId,
        student_number: studentNumber
      });
      
      Utils.showToast('학생 계정이 생성되었습니다.', 'success');
      return userData;
    } catch (error) {
      console.error('Create student error:', error);
      Utils.handleError(error, error.message || '학생 계정 생성에 실패했습니다.');
      throw error;
    }
  },
  
  // 현재 사용자 가져오기
  getCurrentUser() {
    if (this.currentUser) {
      return this.currentUser;
    }
    
    const stored = Utils.storage.get(window.CONFIG.STORAGE_KEYS.USER);
    if (stored) {
      this.currentUser = stored;
      return stored;
    }
    
    return null;
  },
  
  // 인증 확인
  isAuthenticated() {
    return !!this.getCurrentUser();
  },
  
  // 역할 확인
  hasRole(role) {
    const user = this.getCurrentUser();
    return user && user.role === role;
  },
  
  // 페이지 접근 권한 확인
  requireAuth(requiredRole = null) {
    const user = this.getCurrentUser();
    
    if (!user) {
      Utils.showToast('로그인이 필요합니다.', 'warning');
      window.location.href = '/login.html';
      return false;
    }
    
    if (requiredRole && user.role !== requiredRole) {
      Utils.showToast('접근 권한이 없습니다.', 'error');
      window.location.href = user.role === 'teacher' ? '/teacher/dashboard.html' : '/student/dashboard.html';
      return false;
    }
    
    return true;
  },
  
  // 비밀번호 재설정
  async resetPassword(email) {
    try {
      const { error } = await SupabaseClient.getInstance().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`
      });
      
      if (error) throw error;
      
      Utils.showToast('비밀번호 재설정 이메일이 발송되었습니다.', 'success');
    } catch (error) {
      console.error('Password reset error:', error);
      Utils.handleError(error, '비밀번호 재설정에 실패했습니다.');
      throw error;
    }
  },
  
  // 비밀번호 변경
  async updatePassword(newPassword) {
    try {
      const { error } = await SupabaseClient.getInstance().auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      Utils.showToast('비밀번호가 변경되었습니다.', 'success');
    } catch (error) {
      console.error('Password update error:', error);
      Utils.handleError(error, '비밀번호 변경에 실패했습니다.');
      throw error;
    }
  }
};

// 전역으로 export
window.Auth = Auth;

// 전역으로 export
window.Auth = Auth;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
  await Auth.init();
});
