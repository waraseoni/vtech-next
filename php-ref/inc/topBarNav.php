<?php
$current_page = isset($_GET['p']) ? $_GET['p'] : 'home';
?>
<nav class="navbar navbar-expand-lg navbar-dark fixed-top compact-nav" style="
    background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%) !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    padding: 0.5rem 0;
    min-height: 60px;
    z-index: 1030;
    transition: all 0.3s ease;
">
    <div class="container-fluid px-3 px-md-4">
        <!-- Desktop Layout: Logo Left, Menu Center, Call/Login Right -->
        <div class="d-none d-lg-flex w-100 align-items-center">
            <!-- Desktop Logo (Left) -->
            <a class="navbar-brand py-1" href="./" style="padding: 0; margin-right: 2rem;">
                <img src="<?php echo validate_image($_settings->info('logo')) ?>" height="32" class="logo-img me-2" style="max-height: 32px;">
                <span class="brand-text" style="
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: white;
                ">V-<span style="color: #3b82f6;">Tech</span></span>
            </a>
            
            <!-- Desktop Menu (Center) -->
            <div class="flex-grow-1">
                <ul class="navbar-nav mx-auto compact-nav-links" style="
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 0.3rem;
                ">
                    <li class="nav-item">
                        <a class="nav-link <?= ($current_page == 'home') ? 'active' : '' ?>" href="./" 
                           style="
                                font-size: 0.85rem;
                                font-weight: 500;
                                padding: 0.5rem 0.7rem !important;
                                border-radius: 6px;
                                text-align: center;
                                min-width: 65px;
                                transition: all 0.2s ease;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                color: rgba(255,255,255,0.85) !important;
                           ">
                            <i class="fas fa-home mb-1" style="font-size: 1rem;"></i>
                            <span style="font-size: 0.7rem; line-height: 1;">Home</span>
                        </a>
                    </li>
                    
                    <li class="nav-item">
                        <a class="nav-link <?= ($current_page == 'check_status') ? 'active' : '' ?>" href="./?p=check_status"
                           style="
                                font-size: 0.85rem;
                                font-weight: 500;
                                padding: 0.5rem 0.7rem !important;
                                border-radius: 6px;
                                text-align: center;
                                min-width: 65px;
                                transition: all 0.2s ease;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                color: rgba(255,255,255,0.85) !important;
                           ">
                            <i class="fas fa-search mb-1" style="font-size: 1rem;"></i>
                            <span style="font-size: 0.7rem; line-height: 1;">Status</span>
                        </a>
                    </li>
                    
                    <li class="nav-item">
                        <a class="nav-link <?= ($current_page == 'services') ? 'active' : '' ?>" href="./?p=services"
                           style="
                                font-size: 0.85rem;
                                font-weight: 500;
                                padding: 0.5rem 0.7rem !important;
                                border-radius: 6px;
                                text-align: center;
                                min-width: 65px;
                                transition: all 0.2s ease;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                color: rgba(255,255,255,0.85) !important;
                           ">
                            <i class="fas fa-tools mb-1" style="font-size: 1rem;"></i>
                            <span style="font-size: 0.7rem; line-height: 1;">Services</span>
                        </a>
                    </li>
                    
                    <li class="nav-item">
                        <a class="nav-link <?= ($current_page == 'products') ? 'active' : '' ?>" href="./?p=products"
                           style="
                                font-size: 0.85rem;
                                font-weight: 500;
                                padding: 0.5rem 0.7rem !important;
                                border-radius: 6px;
                                text-align: center;
                                min-width: 65px;
                                transition: all 0.2s ease;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                color: rgba(255,255,255,0.85) !important;
                           ">
                            <i class="fas fa-box mb-1" style="font-size: 1rem;"></i>
                            <span style="font-size: 0.7rem; line-height: 1;">Products</span>
                        </a>
                    </li>
                    
                    <li class="nav-item">
                        <a class="nav-link <?= ($current_page == 'contact_us') ? 'active' : '' ?>" href="./?p=contact_us"
                           style="
                                font-size: 0.85rem;
                                font-weight: 500;
                                padding: 0.5rem 0.7rem !important;
                                border-radius: 6px;
                                text-align: center;
                                min-width: 65px;
                                transition: all 0.2s ease;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                color: rgba(255,255,255,0.85) !important;
                           ">
                            <i class="fas fa-phone-alt mb-1" style="font-size: 1rem;"></i>
                            <span style="font-size: 0.7rem; line-height: 1;">Contact</span>
                        </a>
                    </li>
                    
                    <li class="nav-item">
                        <a class="nav-link <?= ($current_page == 'about') ? 'active' : '' ?>" href="./?p=about"
                           style="
                                font-size: 0.85rem;
                                font-weight: 500;
                                padding: 0.5rem 0.7rem !important;
                                border-radius: 6px;
                                text-align: center;
                                min-width: 65px;
                                transition: all 0.2s ease;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                color: rgba(255,255,255,0.85) !important;
                           ">
                            <i class="fas fa-info-circle mb-1" style="font-size: 1rem;"></i>
                            <span style="font-size: 0.7rem; line-height: 1;">About</span>
                        </a>
                    </li>
                </ul>
            </div>
            
            <!-- Desktop Actions (Right) -->
            <div class="d-flex align-items-center ms-3">
                <a href="tel:+919179105875" class="btn btn-sm me-2" style="
                    background: #3b82f6;
                    color: white;
                    padding: 0.3rem 0.8rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    border: none;
                    text-decoration: none;
                ">
                    <i class="fas fa-phone-alt me-1"></i> Call
                </a>
                
                <a class="btn btn-sm" href="./admin" style="
                    background: rgba(255,255,255,0.1);
                    color: white;
                    padding: 0.3rem 0.8rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    border: 1px solid rgba(255,255,255,0.2);
                    text-decoration: none;
                ">
                    <i class="fas fa-sign-in-alt me-1"></i> Login
                </a>
            </div>
        </div>
        
        <!-- Mobile Layout: Logo Center, Call & Menu on sides -->
        <div class="d-flex d-lg-none w-100 align-items-center" style="position: relative; height: 60px;">
            <!-- Left: Call Button -->
            <div style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); z-index: 2;">
                <a href="tel:+919179105875" class="btn btn-sm" style="
                    background: #3b82f6;
                    color: white;
                    padding: 0.4rem 0.8rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    border: none;
                    text-decoration: none;
                    white-space: nowrap;
                ">
                    <i class="fas fa-phone-alt"></i>
                </a>
            </div>
            
            <!-- Center: Logo -->
            <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 1; width: auto;">
                <a class="navbar-brand py-1 mx-auto" href="./" style="
                    display: inline-block;
                    padding: 0;
                    margin: 0;
                    text-align: center;
                ">
                    <img src="<?php echo validate_image($_settings->info('logo')) ?>" height="32" class="logo-img" style="max-height: 32px; display: inline-block; vertical-align: middle;">
                    <span class="brand-text" style="
                        font-size: 1.3rem;
                        font-weight: 700;
                        color: white;
                        display: inline-block;
                        margin-left: 5px;
                        vertical-align: middle;
                    ">V-<span style="color: #3b82f6;">Tech</span></span>
                </a>
            </div>
            
            <!-- Right: Menu Toggle -->
            <div style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); z-index: 2;">
                <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#mobileNavMenu" 
                        aria-controls="mobileNavMenu" aria-expanded="false" aria-label="Toggle navigation"
                        style="
                            border: 1px solid rgba(255,255,255,0.3);
                            padding: 0.4rem 0.6rem;
                            border-radius: 6px;
                            outline: none !important;
                            box-shadow: none !important;
                            background: rgba(0,0,0,0.2);
                        ">
                    <span class="navbar-toggler-icon"></span>
                </button>
            </div>
        </div>
    </div>
    
    <!-- Mobile Navbar Menu (Mobile only - Completely Hidden on Desktop) -->
    <div class="collapse navbar-collapse" id="mobileNavMenu" style="
        display: none; /* Initially hidden */
    ">
        <div class="mobile-nav-container" style="
            position: fixed;
            top: 60px;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 15, 26, 0.98);
            backdrop-filter: blur(10px);
            z-index: 1025;
            overflow-y: auto;
            padding: 1rem;
            border-top: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        ">
            <!-- Mobile Menu Items -->
            <ul class="navbar-nav mobile-nav-links">
                <li class="nav-item mobile-nav-item">
                    <a class="nav-link d-flex align-items-center py-3 <?= ($current_page == 'home') ? 'mobile-active' : '' ?>" 
                       href="./"
                       style="
                            color: white;
                            border-bottom: 1px solid rgba(255,255,255,0.1);
                            text-decoration: none;
                            transition: all 0.2s;
                       ">
                        <div class="mobile-nav-icon mr-3" style="
                            width: 40px;
                            height: 40px;
                            background: rgba(59,130,246,0.15);
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <i class="fas fa-home" style="color: #3b82f6; font-size: 1.2rem;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div style="font-weight: 500; font-size: 1.1rem;">Home</div>
                            <div style="font-size: 0.85rem; color: #94a3b8;">Main Dashboard</div>
                        </div>
                        <i class="fas fa-chevron-right ml-2" style="color: rgba(255,255,255,0.3);"></i>
                    </a>
                </li>
                
                <li class="nav-item mobile-nav-item">
                    <a class="nav-link d-flex align-items-center py-3 <?= ($current_page == 'check_status') ? 'mobile-active' : '' ?>" 
                       href="./?p=check_status"
                       style="
                            color: white;
                            border-bottom: 1px solid rgba(255,255,255,0.1);
                            text-decoration: none;
                            transition: all 0.2s;
                       ">
                        <div class="mobile-nav-icon mr-3" style="
                            width: 40px;
                            height: 40px;
                            background: rgba(59,130,246,0.15);
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <i class="fas fa-search" style="color: #3b82f6; font-size: 1.2rem;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div style="font-weight: 500; font-size: 1.1rem;">Check Status</div>
                            <div style="font-size: 0.85rem; color: #94a3b8;">Track your repair status</div>
                        </div>
                        <i class="fas fa-chevron-right ml-2" style="color: rgba(255,255,255,0.3);"></i>
                    </a>
                </li>
                
                <li class="nav-item mobile-nav-item">
                    <a class="nav-link d-flex align-items-center py-3 <?= ($current_page == 'services') ? 'mobile-active' : '' ?>" 
                       href="./?p=services"
                       style="
                            color: white;
                            border-bottom: 1px solid rgba(255,255,255,0.1);
                            text-decoration: none;
                            transition: all 0.2s;
                       ">
                        <div class="mobile-nav-icon mr-3" style="
                            width: 40px;
                            height: 40px;
                            background: rgba(59,130,246,0.15);
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <i class="fas fa-tools" style="color: #3b82f6; font-size: 1.2rem;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div style="font-weight: 500; font-size: 1.1rem;">Services</div>
                            <div style="font-size: 0.85rem; color: #94a3b8;">Our professional repair services</div>
                        </div>
                        <i class="fas fa-chevron-right ml-2" style="color: rgba(255,255,255,0.3);"></i>
                    </a>
                </li>
                
                <li class="nav-item mobile-nav-item">
                    <a class="nav-link d-flex align-items-center py-3 <?= ($current_page == 'products') ? 'mobile-active' : '' ?>" 
                       href="./?p=products"
                       style="
                            color: white;
                            border-bottom: 1px solid rgba(255,255,255,0.1);
                            text-decoration: none;
                            transition: all 0.2s;
                       ">
                        <div class="mobile-nav-icon mr-3" style="
                            width: 40px;
                            height: 40px;
                            background: rgba(59,130,246,0.15);
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <i class="fas fa-box" style="color: #3b82f6; font-size: 1.2rem;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div style="font-weight: 500; font-size: 1.1rem;">Products</div>
                            <div style="font-size: 0.85rem; color: #94a3b8;">Available products for sale</div>
                        </div>
                        <i class="fas fa-chevron-right ml-2" style="color: rgba(255,255,255,0.3);"></i>
                    </a>
                </li>
                
                <li class="nav-item mobile-nav-item">
                    <a class="nav-link d-flex align-items-center py-3 <?= ($current_page == 'contact_us') ? 'mobile-active' : '' ?>" 
                       href="./?p=contact_us"
                       style="
                            color: white;
                            border-bottom: 1px solid rgba(255,255,255,0.1);
                            text-decoration: none;
                            transition: all 0.2s;
                       ">
                        <div class="mobile-nav-icon mr-3" style="
                            width: 40px;
                            height: 40px;
                            background: rgba(59,130,246,0.15);
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <i class="fas fa-phone-alt" style="color: #3b82f6; font-size: 1.2rem;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div style="font-weight: 500; font-size: 1.1rem;">Contact Us</div>
                            <div style="font-size: 0.85rem; color: #94a3b8;">Get in touch with us</div>
                        </div>
                        <i class="fas fa-chevron-right ml-2" style="color: rgba(255,255,255,0.3);"></i>
                    </a>
                </li>
                
                <li class="nav-item mobile-nav-item">
                    <a class="nav-link d-flex align-items-center py-3 <?= ($current_page == 'about') ? 'mobile-active' : '' ?>" 
                       href="./?p=about"
                       style="
                            color: white;
                            border-bottom: 1px solid rgba(255,255,255,0.1);
                            text-decoration: none;
                            transition: all 0.2s;
                       ">
                        <div class="mobile-nav-icon mr-3" style="
                            width: 40px;
                            height: 40px;
                            background: rgba(59,130,246,0.15);
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <i class="fas fa-info-circle" style="color: #3b82f6; font-size: 1.2rem;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div style="font-weight: 500; font-size: 1.1rem;">About Us</div>
                            <div style="font-size: 0.85rem; color: #94a3b8;">Our story and mission</div>
                        </div>
                        <i class="fas fa-chevron-right ml-2" style="color: rgba(255,255,255,0.3);"></i>
                    </a>
                </li>
            </ul>
            
            <!-- Mobile Action Buttons -->
            <div class="mobile-actions mt-4 pt-3 border-top" style="border-color: rgba(255,255,255,0.1) !important;">
                <div class="row g-2">
                    <div class="col-6">
                        <a href="tel:+919179105875" class="btn btn-block py-2" style="
                            background: #3b82f6;
                            color: white;
                            border-radius: 10px;
                            font-weight: 600;
                            text-decoration: none;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 0.95rem;
                        ">
                            <i class="fas fa-phone mr-2"></i> Call Now
                        </a>
                    </div>
                    <div class="col-6">
                        <a href="https://wa.me/919179105875" class="btn btn-block py-2" style="
                            background: #25D366;
                            color: white;
                            border-radius: 10px;
                            font-weight: 600;
                            text-decoration: none;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 0.95rem;
                        " target="_blank">
                            <i class="fab fa-whatsapp mr-2"></i> WhatsApp
                        </a>
                    </div>
                    <div class="col-12 mt-2">
                        <a href="./admin" class="btn btn-block py-2" style="
                            background: rgba(255,255,255,0.1);
                            color: white;
                            border-radius: 10px;
                            font-weight: 600;
                            text-decoration: none;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 0.95rem;
                            border: 1px solid rgba(255,255,255,0.2);
                        ">
                            <i class="fas fa-sign-in-alt mr-2"></i> Admin Login
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- Mobile Contact Info -->
            <div class="mobile-contact-info mt-3 pt-3 border-top" style="border-color: rgba(255,255,255,0.1) !important;">
                <div class="text-center">
                    <p class="mb-1" style="font-size: 0.9rem; color: #94a3b8;">
                        <i class="fas fa-phone mr-1"></i> +91 91791 05875
                    </p>
                    <p class="mb-0" style="font-size: 0.9rem; color: #94a3b8;">
                        <i class="fas fa-clock mr-1"></i> 24×7 Service Available
                    </p>
                </div>
            </div>
            
            <!-- Close Button -->
            <div class="text-center mt-4">
                <button class="btn btn-sm close-mobile-menu" style="
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border-radius: 20px;
                    padding: 0.5rem 2rem;
                    border: 1px solid rgba(255,255,255,0.2);
                ">
                    <i class="fas fa-times mr-2"></i> Close Menu
                </button>
            </div>
        </div>
    </div>
</nav>

<style>
/* Desktop Active State */
.compact-nav .nav-link.active {
    background: rgba(59,130,246,0.15) !important;
    color: #3b82f6 !important;
    font-weight: 600 !important;
}

/* Desktop Hover Effects */
.compact-nav .nav-link:hover {
    background: rgba(59,130,246,0.1) !important;
    color: #3b82f6 !important;
    transform: translateY(-1px);
}

/* Mobile Menu Styles */
.mobile-nav-item .nav-link:hover {
    background: rgba(59,130,246,0.1) !important;
}

.mobile-nav-item .nav-link.mobile-active {
    background: rgba(59,130,246,0.2) !important;
    color: #3b82f6 !important;
}

.mobile-nav-item .nav-link.mobile-active .mobile-nav-icon {
    background: rgba(59,130,246,0.3) !important;
}

/* Smooth animations */
.compact-nav .nav-link, .mobile-nav-item .nav-link {
    transition: all 0.2s ease !important;
}

/* Mobile Menu Animation */
.mobile-nav-container {
    animation: slideDown 0.3s ease;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Responsive adjustments */
@media (max-width: 1199px) {
    .compact-nav-links {
        gap: 0.1rem !important;
    }
    
    .compact-nav .nav-link {
        min-width: 60px !important;
        padding: 0.4rem 0.6rem !important;
    }
}

@media (max-width: 991px) {
    body {
        padding-top: 60px !important;
    }
    
    .compact-nav {
        padding: 0.4rem 0 !important;
        min-height: 56px !important;
    }
    
    /* Hide desktop navbar on mobile */
    .d-none.d-lg-flex {
        display: none !important;
    }
    
    /* Show mobile navbar */
    .d-flex.d-lg-none {
        display: flex !important;
    }
    
    /* Mobile menu styling */
    .mobile-nav-container {
        max-height: 85vh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
    }
}

@media (min-width: 992px) {
    /* Hide mobile layout on desktop */
    .d-flex.d-lg-none {
        display: none !important;
    }
    
    /* Hide mobile menu container on desktop */
    #mobileNavMenu {
        display: none !important;
    }
    
    .mobile-nav-container {
        display: none !important;
    }
    
    /* Show desktop layout */
    .d-none.d-lg-flex {
        display: flex !important;
    }
}

@media (max-width: 576px) {
    .brand-text {
        font-size: 1.1rem !important;
    }
    
    .logo-img {
        height: 28px !important;
    }
    
    .compact-nav {
        padding: 0.3rem 0 !important;
        min-height: 54px !important;
    }
    
    .mobile-nav-icon {
        width: 36px !important;
        height: 36px !important;
    }
    
    .mobile-nav-item .nav-link {
        padding: 0.8rem 0 !important;
    }
    
    /* Mobile button sizes */
    .d-flex.d-lg-none .btn-sm {
        padding: 0.3rem 0.6rem !important;
        font-size: 0.75rem !important;
    }
    
    .navbar-toggler {
        padding: 0.3rem 0.5rem !important;
    }
    
    /* Adjust positions for smaller screens */
    .d-flex.d-lg-none > div {
        padding: 0 10px;
    }
    
    .d-flex.d-lg-none > div:first-child {
        left: 10px !important;
    }
    
    .d-flex.d-lg-none > div:last-child {
        right: 10px !important;
    }
}

/* Fix for mobile menu positioning */
.navbar-collapse {
    flex-grow: 0 !important;
}

/* Navbar scroll effect */
.compact-nav.scrolled {
    padding: 0.3rem 0 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
}

/* Ensure mobile menu doesn't show on desktop */
@media (min-width: 992px) {
    #mobileNavMenu,
    .mobile-nav-container,
    .navbar-toggler {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
    }
}

/* Fix for mobile layout */
.d-flex.d-lg-none {
    height: 60px;
    position: relative;
}

.d-flex.d-lg-none > div {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
}

.d-flex.d-lg-none > div:nth-child(1) {
    left: 15px;
}

.d-flex.d-lg-none > div:nth-child(2) {
    left: 50%;
    transform: translate(-50%, -50%);
}

.d-flex.d-lg-none > div:nth-child(3) {
    right: 15px;
}
</style>

<script>
$(document).ready(function() {
    // Toggle mobile menu with custom show/hide
    $('.navbar-toggler').click(function() {
        var mobileMenu = $('#mobileNavMenu');
        if (mobileMenu.css('display') === 'none') {
            mobileMenu.show();
            $('.mobile-nav-container').show();
            $('body').addClass('menu-open');
        } else {
            mobileMenu.hide();
            $('.mobile-nav-container').hide();
            $('body').removeClass('menu-open');
        }
    });
    
    // Close menu button
    $('.close-mobile-menu').click(function() {
        $('#mobileNavMenu').hide();
        $('.mobile-nav-container').hide();
        $('body').removeClass('menu-open');
    });
    
    // Close menu when clicking a link
    $('.mobile-nav-item .nav-link').click(function(e) {
        setTimeout(function() {
            $('#mobileNavMenu').hide();
            $('.mobile-nav-container').hide();
            $('body').removeClass('menu-open');
        }, 300);
    });
    
    // Close menu when clicking outside (only on mobile)
    $(document).click(function(e) {
        if ($(window).width() <= 991) {
            if (!$(e.target).closest('.compact-nav').length && 
                !$(e.target).closest('#mobileNavMenu').length && 
                $('#mobileNavMenu').is(':visible')) {
                $('#mobileNavMenu').hide();
                $('.mobile-nav-container').hide();
                $('body').removeClass('menu-open');
            }
        }
    });
    
    // Navbar scroll effect
    $(window).scroll(function() {
        if ($(this).scrollTop() > 30) {
            $('.compact-nav').addClass('scrolled');
        } else {
            $('.compact-nav').removeClass('scrolled');
        }
    });
    
    // Prevent body scroll when menu is open on mobile
    function toggleBodyScroll(open) {
        if ($(window).width() <= 991) {
            if (open) {
                $('body').addClass('menu-open');
            } else {
                $('body').removeClass('menu-open');
            }
        }
    }
    
    // Handle keyboard navigation
    $(document).keydown(function(e) {
        if (e.key === 'Escape' && $('#mobileNavMenu').is(':visible')) {
            $('#mobileNavMenu').hide();
            $('.mobile-nav-container').hide();
            $('body').removeClass('menu-open');
        }
    });
    
    // Initialize on load
    if ($(window).scrollTop() > 30) {
        $('.compact-nav').addClass('scrolled');
    }
    
    // Hide mobile menu on desktop resize
    $(window).resize(function() {
        if ($(window).width() > 991) {
            $('#mobileNavMenu').hide();
            $('.mobile-nav-container').hide();
            $('body').removeClass('menu-open');
        }
    });
});

// Add CSS for body when menu is open
$(document).ready(function() {
    var style = document.createElement('style');
    style.innerHTML = `
        body.menu-open {
            overflow: hidden !important;
            position: fixed;
            width: 100%;
            height: 100%;
        }
        
        @media (min-width: 992px) {
            body.menu-open {
                overflow: auto !important;
                position: static;
            }
        }
    `;
    document.head.appendChild(style);
});
</script>