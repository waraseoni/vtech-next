<style>
    /* Remove conflicting carousel styles if not needed */
    .carousel-item>img {
        object-fit: fill !important;
    }
    #carouselExampleControls .carousel-inner {
        height: 280px !important;
    }
</style>
<?php
$brands = isset($_GET['b']) ? json_decode(urldecode($_GET['b']), true) : array();
?>

<!-- Hero Section -->
<section class="hero" style="
    background: linear-gradient(rgba(15,15,26,0.92), rgba(15,15,26,0.95)), 
                url('https://images.unsplash.com/photo-1516280440614-37939bbacd81?ixlib=rb-4.0.3&auto=format&fit=crop&q=80') center/cover no-repeat;
    height: calc(100vh - 60px);
    display: flex;
    align-items: center;
    color: white;
    text-align: center;
    margin-top: -1rem;
    padding-top: 1rem;
">
    <div class="container">
        <h1 style="
            font-size: 3.5rem;
            margin-bottom: 20px;
            font-weight: 700;
            line-height: 1.2;
        ">Expert Stage Lighting &<br>Power Supply Repair Center</h1>
        <p style="
            font-size: 1.2rem;
            max-width: 900px;
            margin: 0 auto 40px;
            line-height: 1.6;
        ">SMPS | Sharpy | Moving Head | Par Lights | DMX | Laser | LED Wall | Fog Machine<br>Fast Repair • Genuine Parts • Same Day Service</p>
        <div>
            <a href="tel:9179105875" class="btn" style="
                background: #3b82f6;
                color: white;
                padding: 16px 40px;
                font-size: 1.1rem;
                border: none;
                border-radius: 50px;
                text-decoration: none;
                display: inline-block;
                margin: 10px;
                font-weight: 600;
                transition: 0.3s;
            ">Call +91 917910 5875</a>
            <a href="https://wa.me/9179105875" class="btn" style="
                background: #25d366;
                color: white;
                padding: 16px 40px;
                font-size: 1.1rem;
                border: none;
                border-radius: 50px;
                text-decoration: none;
                display: inline-block;
                margin: 10px;
                font-weight: 600;
                transition: 0.3s;
            ">WhatsApp Us</a>
        </div>
    </div>
</section>

<!-- Services -->
<section class="services py-5" style="background: #0f0f1a; color: white;">
    <div class="container">
        <h2 class="text-center mb-5" style="font-size: 2.5rem; font-weight: 700;">
            Our Professional <span style="color: #3b82f6;">Repair Services</span>
        </h2>
        <div class="row">
            <div class="col-md-3 col-sm-6 mb-4">
                <div class="service-card text-center p-4" style="
                    background: #1a1a2e;
                    border-radius: 16px;
                    border: 1px solid #333;
                    transition: all 0.4s;
                    height: 100%;
                ">
                    <i class="fas fa-plug mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                    <h4 style="font-size: 1.3rem; margin-bottom: 10px;">SMPS & Power Supply</h4>
                    <p style="color: #94a3b8;">All types of Switch Mode Power Supply Repair</p>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 mb-4">
                <div class="service-card text-center p-4" style="
                    background: #1a1a2e;
                    border-radius: 16px;
                    border: 1px solid #333;
                    transition: all 0.4s;
                    height: 100%;
                ">
                    <i class="fas fa-lightbulb mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                    <h4 style="font-size: 1.3rem; margin-bottom: 10px;">Sharpy & Moving Head</h4>
                    <p style="color: #94a3b8;">Beam, Color Wheel, Gobo, Motor Repair</p>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 mb-4">
                <div class="service-card text-center p-4" style="
                    background: #1a1a2e;
                    border-radius: 16px;
                    border: 1px solid #333;
                    transition: all 0.4s;
                    height: 100%;
                ">
                    <i class="fas fa-theater-masks mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                    <h4 style="font-size: 1.3rem; margin-bottom: 10px;">Par Light & LED Par</h4>
                    <p style="color: #94a3b8;">RGBW, Driver Board, LED Replacement</p>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 mb-4">
                <div class="service-card text-center p-4" style="
                    background: #1a1a2e;
                    border-radius: 16px;
                    border: 1px solid #333;
                    transition: all 0.4s;
                    height: 100%;
                ">
                    <i class="fas fa-microchip mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                    <h4 style="font-size: 1.3rem; margin-bottom: 10px;">DMX Controller & Console</h4>
                    <p style="color: #94a3b8;">DMX 512, Motherboard, Touch Screen Repair</p>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 mb-4">
                <div class="service-card text-center p-4" style="
                    background: #1a1a2e;
                    border-radius: 16px;
                    border: 1px solid #333;
                    transition: all 0.4s;
                    height: 100%;
                ">
                    <i class="fas fa-snowflake mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                    <h4 style="font-size: 1.3rem; margin-bottom: 10px;">Fog & Smoke Machine</h4>
                    <p style="color: #94a3b8;">Pump, Heating Element, PCB Repair</p>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 mb-4">
                <div class="service-card text-center p-4" style="
                    background: #1a1a2e;
                    border-radius: 16px;
                    border: 1px solid #333;
                    transition: all 0.4s;
                    height: 100%;
                ">
                    <i class="fas fa-video mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                    <h4 style="font-size: 1.3rem; margin-bottom: 10px;">LED Wall & Processor</h4>
                    <p style="color: #94a3b8;">Module, Receiving Card, Power Supply Fix</p>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 mb-4">
                <div class="service-card text-center p-4" style="
                    background: #1a1a2e;
                    border-radius: 16px;
                    border: 1px solid #333;
                    transition: all 0.4s;
                    height: 100%;
                ">
                    <i class="fas fa-laser mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                    <h4 style="font-size: 1.3rem; margin-bottom: 10px;">Laser Light Repair</h4>
                    <p style="color: #94a3b8;">Galvo, Driver, Diode Replacement</p>
                </div>
            </div>
            <div class="col-md-3 col-sm-6 mb-4">
                <div class="service-card text-center p-4" style="
                    background: #1a1a2e;
                    border-radius: 16px;
                    border: 1px solid #333;
                    transition: all 0.4s;
                    height: 100%;
                ">
                    <i class="fas fa-tools mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                    <h4 style="font-size: 1.3rem; margin-bottom: 10px;">All Stage Equipment</h4>
                    <p style="color: #94a3b8;">Strobe, Follow Spot, Effect Lights etc.</p>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Why Choose Us -->
<section class="why-us py-5" style="background: #16213e; color: white;">
    <div class="container">
        <h2 class="text-center mb-5" style="font-size: 2.5rem; font-weight: 700;">
            Why Choose <span style="color: #3b82f6;">V-Technologies</span>
        </h2>
        <div class="row">
            <div class="col-md-4 text-center mb-4">
                <i class="fas fa-bolt mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                <h4 style="font-size: 1.3rem; margin-bottom: 10px;">Express Repair</h4>
                <p style="color: #94a3b8;">Most jobs done same day</p>
            </div>
            <div class="col-md-4 text-center mb-4">
                <i class="fas fa-cogs mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                <h4 style="font-size: 1.3rem; margin-bottom: 10px;">Genuine Parts</h4>
                <p style="color: #94a3b8;">100% original spares used</p>
            </div>
            <div class="col-md-4 text-center mb-4">
                <i class="fas fa-rupee-sign mb-3" style="font-size: 3rem; color: #3b82f6;"></i>
                <h4 style="font-size: 1.3rem; margin-bottom: 10px;">Best Rates</h4>
                <p style="color: #94a3b8;">Transparent & fair pricing</p>
            </div>
        </div>
    </div>
</section>

<!-- Contact Bar -->
<section class="contact-bar py-5" style="
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    text-align: center;
">
    <div class="container">
        <h2 style="font-size: 2.2rem; margin-bottom: 1.5rem;">Need Urgent Repair? Contact Us Now!</h2>
        <p style="font-size: 1.2rem; margin: 20px 0;">
            <i class="fas fa-phone"></i> +91 91791 05875<br>
            <i class="fab fa-whatsapp"></i> WhatsApp: +91 91791 05875<br>
            <i class="fas fa-map-marker-alt"></i> Vikram Jain V-Technologies, F4, Madhushala, Beside Jayanti, Marhatal, Jabalpur, 482002
        </p>
        <a href="tel:+919179105875" class="btn" style="
            background: white;
            color: #3b82f6;
            padding: 16px 40px;
            font-size: 1.1rem;
            border: none;
            border-radius: 50px;
            text-decoration: none;
            display: inline-block;
            font-weight: 600;
            transition: 0.3s;
        ">Call Now</a>
    </div>
</section>

<!-- Floating Buttons -->
<div class="floating-buttons">
    <a href="tel:+919179105875" class="float-btn call-btn" style="
        background: #3b82f6;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: white;
        box-shadow: 0 8px 25px rgba(0,0,0,0.4);
        transition: all 0.3s;
        text-decoration: none;
    ">
        <i class="fas fa-phone"></i>
    </a>
    <a href="https://wa.me/+919179105875" class="float-btn whatsapp-btn" style="
        background: #25d366;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: white;
        box-shadow: 0 8px 25px rgba(0,0,0,0.4);
        transition: all 0.3s;
        text-decoration: none;
    " target="_blank">
        <i class="fab fa-whatsapp"></i>
    </a>
</div>

<style>
/* Service card hover effect */
.service-card:hover {
    transform: translateY(-10px);
    border-color: #3b82f6;
    box-shadow: 0 15px 30px rgba(59,130,246,0.2);
}

/* Floating buttons position */
.floating-buttons {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.float-btn:hover {
    transform: scale(1.1);
}

/* Responsive */
@media (max-width: 768px) {
    .hero h1 {
        font-size: 2.5rem !important;
    }
    
    .hero p {
        font-size: 1rem !important;
    }
    
    .btn {
        padding: 12px 25px !important;
        font-size: 1rem !important;
        margin: 5px !important;
    }
    
    .float-btn {
        width: 50px !important;
        height: 50px !important;
        font-size: 20px !important;
    }
}
</style>

<script>
$(document).ready(function() {
    // Add hover effects to service cards
    $('.service-card').hover(
        function() {
            $(this).css({
                'transform': 'translateY(-10px)',
                'border-color': '#3b82f6',
                'box-shadow': '0 15px 30px rgba(59,130,246,0.2)'
            });
        },
        function() {
            $(this).css({
                'transform': 'translateY(0)',
                'border-color': '#333',
                'box-shadow': 'none'
            });
        }
    );
    
    // Floating buttons animation
    function pulseAnimation() {
        $('.float-btn').css('box-shadow', '0 0 0 0 rgba(59,130,246,0.7)');
        setTimeout(function() {
            $('.float-btn').css('box-shadow', '0 8px 25px rgba(0,0,0,0.4)');
        }, 2000);
    }
    
    setInterval(pulseAnimation, 4000);
});
</script>