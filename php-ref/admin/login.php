<?php require_once('../config.php') ?>
<!DOCTYPE html>
<html lang="en" class="" style="height: auto;">
 <?php require_once('inc/header.php') ?>
<body class="hold-transition login-page">
  <script>
    start_loader()
  </script>
  <style>
    /* Global Styles & Reset */
    body {
      background-image: url("<?php echo validate_image($_settings->info('cover')) ?>");
      background-size: cover;
      background-repeat: no-repeat;
      background-position: center;
      background-attachment: fixed; /* Parallax effect */
      backdrop-filter: contrast(1);
      /* Centering Magic */
      display: flex;
      flex-direction: column;
      justify-content: center; /* Centers vertical */
      align-items: center; /* Centers horizontal */
      min-height: 100vh;
      margin: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    /* Heading Styles - Mobile Optimized */
    #page-title {
      text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.7);
      color: #fff !important;
      background: rgba(0, 0, 0, 0.2); /* Slight dark backing for readability */
      padding: 10px 20px;
      border-radius: 50px;
      backdrop-filter: blur(4px);
      margin-bottom: 20px;
      font-weight: 700;
      transition: all 0.3s ease;
      text-align: center;
    }

    /* Desktop Size */
    @media (min-width: 768px) {
      #page-title {
        font-size: 3.5em;
      }
      .login-box {
        width: 400px;
      }
    }

    /* Mobile Size - Smaller & Compact */
    @media (max-width: 767px) {
      #page-title {
        font-size: 1.8em; /* Much smaller for mobile */
        margin-top: -50px; /* Pulls it up slightly */
      }
      .login-box {
        width: 90%; /* Responsive width */
        margin-top: 10px;
      }
    }

    /* Login Box Container */
    .login-box {
      margin: 0 auto;
    }

    /* Creative Card Design */
    .login-card {
      background: rgba(255, 255, 255, 0.92); /* Glassy white */
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      animation: slideUp 0.6s ease-out; /* Entrance animation */
    }

    /* Animation Keyframes */
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .login-header {
      background: linear-gradient(135deg, #001f3f 0%, #003366 100%);
      color: white;
      padding: 25px 20px;
      text-align: center;
      position: relative;
    }
    
    .login-header h4 {
        margin: 0;
        font-weight: 300;
        letter-spacing: 1px;
    }

    .login-body {
      padding: 30px;
    }

    /* Form Elements */
    .form-group {
      margin-bottom: 25px;
    }
    
    .input-group {
      position: relative;
      border-bottom: 2px solid #ddd;
      transition: border-color 0.3s;
    }
    
    .input-group:focus-within {
      border-color: #001f3f;
    }

    .input-icon {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      color: #aaa;
      z-index: 10;
      font-size: 1.1em;
      transition: color 0.3s;
    }
    
    .input-group:focus-within .input-icon {
      color: #001f3f;
    }

    .form-control {
      padding-left: 30px;
      border: none;
      background: transparent;
      height: 45px;
      width: 100%;
      outline: none;
      box-shadow: none !important; /* Remove bootstrap focus glow */
    }

    /* Button Styling */
    .btn-login {
      background: linear-gradient(to right, #001f3f, #003366);
      color: white;
      border: none;
      height: 50px;
      font-weight: 600;
      letter-spacing: 0.5px;
      width: 100%;
      border-radius: 25px; /* Pill shape */
      transition: all 0.3s;
      box-shadow: 0 4px 15px rgba(0, 31, 63, 0.2);
    }
    
    .btn-login:hover {
      background: linear-gradient(to right, #003366, #004080);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 31, 63, 0.3);
    }
    
    .btn-login:disabled {
        background: #ccc;
        transform: none;
    }

    .password-toggle {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      z-index: 10;
    }
    
    .password-toggle:hover {
        color: #001f3f;
    }

    .website-link {
      text-align: center;
      margin-top: 20px;
    }
    
    .website-link a {
      color: #666;
      text-decoration: none;
      font-size: 0.9em;
      transition: color 0.3s;
    }
    
    .website-link a:hover {
      color: #001f3f;
      font-weight: 600;
    }

    /* Alerts */
    .alert {
      border-radius: 8px;
      padding: 12px 15px;
      margin-bottom: 25px;
      font-size: 0.9em;
      border: none;
    }
  </style>
  
  <div style="width: 100%; max-width: 100%;">
      
      <h1 id="page-title"><b><?php echo $_settings->info('name') ?></b></h1>
      
      <div class="login-box">
        <div class="login-card">
          <div class="login-header">
            <h4>Welcome Back</h4>
            <p class="login-box-msg mb-0" style="font-size: 0.9em; opacity: 0.8;">Sign in to your account</p>
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
              
              <div class="row align-items-center mt-4">
                <div class="col-12">
                  <button type="submit" class="btn btn-login" id="loginBtn">SIGN IN</button>
                </div>
                <div class="col-12 website-link">
                  <a href="<?php echo base_url ?>"><i class="fas fa-arrow-left mr-1"></i> Back to Website</a>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

  </div> <script>
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
      $('#loginBtn').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Signing in...');
    });
    
    // Auto-hide alerts after 5 seconds
    setTimeout(function(){
      $('.alert').fadeOut('slow');
    }, 5000);
  });
</script>
</body>
</html>