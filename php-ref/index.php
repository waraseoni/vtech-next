<?php
/**
 * Main Index Controller
 * Sanitized & Secured Version
 */
require_once('config.php');

// Start session if not already started in config.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Login check: Uncomment and adjust the redirect path as needed
/*
if(!isset($_SESSION['userdata'])){
    header('location: ./login.php');
    exit;
}
*/

// Define the page to include
$page = isset($_GET['p']) ? $_GET['p'] : 'home';

// SANITIZATION: Remove any characters that aren't alphanumeric, underscores, or dashes
$page = preg_replace('/[^a-zA-Z0-9_-]/', '', $page);
// SECURITY: Use basename to prevent any hidden path traversal attempts
$page = basename($page);

// Header Info
$cover_img = validate_image($_settings->info("cover"));
?>
<!DOCTYPE html>
<html lang="en" style="height: auto;">
<head>
    <?php require_once('inc/header.php'); ?>
    <style>
        :root {
            --primary-bg: #0f0f1a;
            --nav-active: #f8f9fa;
        }

        body {
            padding-top: 60px !important;
            background: var(--primary-bg);
            color: #fff;
        }

        #header { 
            height: 70vh; 
            width: 100%; 
            position: relative; 
            top: -1em; 
        }

        #header:before {
            content: "";
            position: absolute;
            height: 100%;
            width: 100%;
            /* XSS Protection: htmlspecialchars ensures the URL is safe */
            background-image: url('<?php echo htmlspecialchars($cover_img, ENT_QUOTES, 'UTF-8'); ?>');
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center center;
        }

        #top-Nav a.nav-link.active { 
            color: var(--nav-active); 
            font-weight: 900; 
            position: relative; 
        }

        #top-Nav a.nav-link.active:before {
            content: "";
            position: absolute;
            border-bottom: 2px solid var(--nav-active);
            width: 33.33%;
            left: 33.33%;
            bottom: 0;
        }

        @media (max-width: 991px) {
            body { padding-top: 56px !important; }
        }
    </style>
</head>
<body>
    <?php require_once('inc/topBarNav.php'); ?>

    <main>
        <?php 
            // Logical check for page inclusion
            if (is_dir($page)) {
                $target = $page . '/index.php';
            } else {
                $target = $page . '.php';
            }

            // Security: Final check to ensure file exists before including
            if (file_exists($target)) {
                include $target;
            } else {
                include '404.html';
            }
        ?>
    </main>

    <?php require_once('inc/footer.php'); ?>

    <div class="modal fade" id="uni_modal" role='dialog' tabindex="-1" aria-hidden="true">
        <div class="modal-dialog rounded-0 modal-md modal-dialog-centered" role="document">
            <div class="modal-content rounded-0">
                <div class="modal-header">
                    <h5 class="modal-title"></h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id='submit' onclick="$('#uni_modal form').submit()">Save</button>
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                </div>
            </div>
        </div>
    </div>
</body>
</html>