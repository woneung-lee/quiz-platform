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
      // Supabase 세션 확인
      const { data: { session }, error } = await SupabaseClient.getInstance().auth.getSession();
      
      if (error) throw error;
      
      if (session && session.user) {
        // 사용자 정보 가져오기
        const userData = await DB.users.getById(session.user.id);
        this.currentUser = {
          ...session.user,
          ...userData
        };
        
        // 로컬 스토리지에 저장
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
  
  // 인증 변경 이벤트 핸들러 (커스텀 이벤트 발생)
  onAuthChange(event) {
    window.dispatchEvent(new CustomEvent('authChange', { detail: { event, user: this.currentUser } }));
  },
  
  // 이메일/비밀번호 회원가입 (선생님)
  async signUpWithEmail(email, password, name) {
    try {
      // Supabase Auth 회원가입
      const { data: authData, error: authError } = await SupabaseClient.getInstance().auth.signUp({
        email,
        password
      });
      
      if (authError) throw authError;
      
      // users 테이블에 정보 저장
      const userData = await DB.users.create({
        id: authData.user.id,
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
      Utils.handleError(error, '회원가입에 실패했습니다.');
      throw error;
    }
  },
  
  // 이메일/비밀번호 로그인 (선생님)
  async signInWithEmail(email, password) {
    try {
      const { data, error } = await SupabaseClient.getInstance().auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      // 사용자 정보 가져오기
      const userData = await DB.users.getById(data.user.id);
      
      // 선생님 계정인지 확인
      if (userData.role !== 'teacher') {
        await this.signOut();
        throw new Error('선생님 계정으로만 로그인할 수 있습니다.');
      }
      
      this.currentUser = {
        ...data.user,
        ...userData
      };
      
      Utils.showToast('로그인 성공!', 'success');
      return this.currentUser;
    } catch (error) {
      console.error('Login error:', error);
      Utils.handleError(error, '로그인에 실패했습니다.');
      throw error;
    }
  },
  
  // 학생 로그인 (username/password)
  async signInStudent(username, password) {
    try {
      // username으로 사용자 찾기
      const student = await DB.users.getByUsername(username);
      
      if (!student) {
        throw new Error('존재하지 않는 학생 계정입니다.');
      }
      
      if (student.role !== 'student') {
        throw new Error('학생 계정이 아닙니다.');
      }
      
      // 이메일로 로그인 (학생은 username@students.local 형식의 이메일 사용)
      const email = `${username}@students.local`;
      
      const { data, error } = await SupabaseClient.getInstance().auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      this.currentUser = {
        ...data.user,
        ...student
      };
      
      Utils.showToast('로그인 성공!', 'success');
      return this.currentUser;
    } catch (error) {
      console.error('Student login error:', error);
      Utils.handleError(error, '로그인에 실패했습니다.');
      throw error;
    }
  },
  
  // 학생 계정 생성 (선생님이 생성)
  async createStudent(name, username, password, teacherId) {
    try {
      // 중복 확인
      try {
        const existing = await DB.users.getByUsername(username);
        if (existing) {
          throw new Error('이미 사용 중인 아이디입니다.');
        }
      } catch (error) {
        // 사용자가 없으면 정상
        if (error.code !== 'PGRST116') throw error;
      }
      
      // 학생용 이메일 생성
      const email = `${username}@students.local`;
      
      // Supabase Auth 회원가입
      const { data: authData, error: authError } = await SupabaseClient.getInstance().auth.signUp({
        email,
        password
      });
      
      if (authError) throw authError;
      
      // users 테이블에 정보 저장
      const userData = await DB.users.create({
        id: authData.user.id,
        email,
        role: 'student',
        name,
        username,
        teacher_id: teacherId
      });
      
      Utils.showToast('학생 계정이 생성되었습니다!', 'success');
      return userData;
    } catch (error) {
      console.error('Create student error:', error);
      Utils.handleError(error, '학생 계정 생성에 실패했습니다.');
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
      
      Utils.showToast('로그아웃되었습니다.', 'info');
      
      // 로그인 페이지로 이동
      window.location.href = '/login.html';
    } catch (error) {
      console.error('Logout error:', error);
      Utils.handleError(error, '로그아웃에 실패했습니다.');
    }
  },
  
  // 비밀번호 재설정 이메일 발송
  async resetPassword(email) {
    try {
      const { error } = await SupabaseClient.getInstance().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`
      });
      
      if (error) throw error;
      
      Utils.showToast('비밀번호 재설정 이메일이 발송되었습니다.', 'success');
      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      Utils.handleError(error, '비밀번호 재설정 이메일 발송에 실패했습니다.');
      throw error;
    }
  },
  
  // 비밀번호 업데이트
  async updatePassword(newPassword) {
    try {
      const { error } = await SupabaseClient.getInstance().auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      Utils.showToast('비밀번호가 변경되었습니다.', 'success');
      return true;
    } catch (error) {
      console.error('Password update error:', error);
      Utils.handleError(error, '비밀번호 변경에 실패했습니다.');
      throw error;
    }
  },
  
  // 현재 사용자 가져오기
  getCurrentUser() {
    return this.currentUser;
  },
  
  // 로그인 여부 확인
  isAuthenticated() {
    return this.currentUser !== null;
  },
  
  // 선생님 여부 확인
  isTeacher() {
    return this.currentUser && this.currentUser.role === 'teacher';
  },
  
  // 학생 여부 확인
  isStudent() {
    return this.currentUser && this.currentUser.role === 'student';
  },
  
  // 권한 확인 및 리다이렉트
  requireAuth(requiredRole = null) {
    if (!this.isAuthenticated()) {
      window.location.href = '/login.html';
      return false;
    }
    
    if (requiredRole && this.currentUser.role !== requiredRole) {
      // 역할이 맞지 않으면 해당 역할의 대시보드로 이동
      if (this.currentUser.role === 'teacher') {
        window.location.href = '/teacher/dashboard.html';
      } else {
        window.location.href = '/student/dashboard.html';
      }
      return false;
    }
    
    return true;
  },
  
  // 사용자 정보 업데이트
  async updateUserProfile(updates) {
    try {
      const updatedUser = await DB.users.update(this.currentUser.id, updates);
      
      this.currentUser = {
        ...this.currentUser,
        ...updatedUser
      };
      
      Utils.storage.set(window.CONFIG.STORAGE_KEYS.USER, this.currentUser);
      
      Utils.showToast('프로필이 업데이트되었습니다.', 'success');
      return this.currentUser;
    } catch (error) {
      console.error('Profile update error:', error);
      Utils.handleError(error, '프로필 업데이트에 실패했습니다.');
      throw error;
    }
  }
};

// 전역으로 export
window.Auth = Auth;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
  await Auth.init();
});
