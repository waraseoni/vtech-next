<?php require_once('../config.php') ?>
<!DOCTYPE html>
<html lang="en" class="" style="height: auto;">
 <?php require_once('inc/header.php') ?>
<body class="hold-transition login-page">
  <script>
    start_loader()
  </script>
  <style>
    body{
      background-image: url("<?php echo validate_image($_settings->info('cover')) ?>");
      background-size:cover;
      background-repeat:no-repeat;
      backdrop-filter: contrast(1);
    }
    #page-title{
      text-shadow: 6px 4px 7px black;
      font-size: 3.5em;
      color: #fff4f4 !important;
      background: #8080801c;
    }
    .login-box {
      max-width: 400px;
      margin: 0 auto;
    }
    .login-card {
      background: white;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      overflow: hidden;
    }
    .login-header {
      background: #001f3f;
      color: white;
      padding: 20px;
      text-align: center;
    }
    .login-body {
      padding: 25px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .input-group {
      position: relative;
    }
    .input-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #6c757d;
      z-index: 10;
    }
    .form-control {
      padding-left: 40px;
      border: 1px solid #ddd;
      border-radius: 5px;
      height: 45px;
      width: 100%;
    }
    .form-control:focus {
      border-color: #001f3f;
      box-shadow: 0 0 0 2px rgba(0,31,63,0.1);
    }
    .btn-login {
      background: #001f3f;
      color: white;
      border: none;
      height: 45px;
      font-weight: 600;
      width: 100%;
      border-radius: 5px;
      transition: background 0.3s;
    }
    .btn-login:hover {
      background: #003366;
    }
    .password-toggle {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #6c757d;
      cursor: pointer;
      z-index: 10;
    }
    .website-link {
      text-align: center;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #eee;
    }
    .website-link a {
      color: #001f3f;
      text-decoration: none;
    }
    .website-link a:hover {
      text-decoration: underline;
    }
    .alert {
      border-radius: 5px;
      padding: 12px 15px;
      margin-bottom: 20px;
    }
    .alert-danger {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      color: #721c24;
    }
    .alert-success {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
    }
  </style>
  
  <h1 class="text-center text-white px-4 py-5" id="page-title"><b><?php echo $_settings->info('name') ?></b></h1>
  
<div class="login-box">
  <div class="login-card">
    <div class="login-header">
      <p class="login-box-msg mb-0">Please enter your credentials</p>
    </div>
    
    <div class="card-body login-body">
      <?php if(isset($_SESSION['error_login'])): ?>
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle mr-2"></i>
        <?php echo $_SESSION['error_login']; unset($_SESSION['error_login']); ?>
      </div>
      <?php endif; ?>
      
      <?php if(isset($_SESSION['success'])): ?>
      <div class="alert alert-success">
        <i class="fas fa-check-circle mr-2"></i>
        <?php echo $_SESSION['success']; unset($_SESSION['success']); ?>
      </div>
      <?php endif; ?>
      
      <form id="login-frm" action="" method="post" autocomplete="off">
        <div class="form-group">
          <div class="input-group">
            <span class="input-icon">
              <i class="fas fa-user"></i>
            </span>
            <input type="text" class="form-control" name="username" placeholder="Username" required autofocus>
          </div>
        </div>
        
        <div class="form-group">
          <div class="input-group">
            <span class="input-icon">
              <i class="fas fa-lock"></i>
            </span>
            <input type="password" class="form-control" name="password" id="password" placeholder="Password" required>
            <button type="button" class="password-toggle" id="togglePassword">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </div>
        
        <div class="row">
          <div class="col-8">
            <a href="<?php echo base_url ?>">Go to Website</a>
          </div>
          <div class="col-4">
            <button type="submit" class="btn btn-login" id="loginBtn">Sign In</button>
          </div>
        </div>
      </form>
    </div>
  </div>
</div>

<script>
  $(document).ready(function(){
    end_loader();
    
    // Password toggle
    $('#togglePassword').click(function(){
      const passwordField = $('#password');
      const icon = $(this).find('i');
      
      if(passwordField.attr('type') === 'password'){
        passwordField.attr('type', 'text');
        icon.removeClass('fa-eye').addClass('fa-eye-slash');
      } else {
        passwordField.attr('type', 'password');
        icon.removeClass('fa-eye-slash').addClass('fa-eye');
      }
    });
    
    // Form submission
    $('#login-frm').submit(function(){
      $('#loginBtn').prop('disabled', true).html('Signing in...');
    });
    
    // Auto-hide alerts after 5 seconds
    setTimeout(function(){
      $('.alert').fadeOut();
    }, 5000);
  });
</script>
</body>
</html>