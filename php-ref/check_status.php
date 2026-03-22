<style>
    :root {
        --bg-primary: #0a0a12;
        --bg-secondary: #1a1a2e;
        --accent-primary: #667eea;
        --accent-secondary: #764ba2;
        --accent-success: #10b981;
        --accent-warning: #f59e0b;
        --text-primary: #ffffff;
        --text-secondary: #b0b0c0;
        --text-muted: #6c757d;
        --glow-color: rgba(102, 126, 234, 0.6);
    }

    body {
        background: linear-gradient(135deg, 
            #0a0a12 0%, 
            #1a1a2e 25%, 
            #2d1b69 50%, 
            #1a1a2e 75%, 
            #0a0a12 100%);
        background-size: 400% 400%;
        animation: gradientShift 15s ease infinite;
        min-height: 100vh;
        position: relative;
        overflow-x: hidden;
    }

    @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }

    /* Animated particles */
    body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: 
            radial-gradient(circle at 20% 30%, rgba(102, 126, 234, 0.1) 0%, transparent 20%),
            radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.1) 0%, transparent 20%),
            radial-gradient(circle at 40% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 20%);
        z-index: -1;
        animation: particles 20s linear infinite;
    }

    @keyframes particles {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    /* Floating elements */
    .floating-element {
        position: absolute;
        background: rgba(102, 126, 234, 0.1);
        border-radius: 50%;
        animation: float 20s infinite linear;
        z-index: -1;
    }

    .floating-element:nth-child(1) {
        width: 300px;
        height: 300px;
        top: -150px;
        right: -150px;
        animation-delay: 0s;
        background: radial-gradient(circle, rgba(102, 126, 234, 0.15) 0%, transparent 70%);
    }

    .floating-element:nth-child(2) {
        width: 200px;
        height: 200px;
        bottom: -100px;
        left: -100px;
        animation-delay: -10s;
        background: radial-gradient(circle, rgba(118, 75, 162, 0.15) 0%, transparent 70%);
    }

    @keyframes float {
        0% {
            transform: rotate(0deg) translateX(20px) rotate(0deg);
        }
        100% {
            transform: rotate(360deg) translateX(20px) rotate(-360deg);
        }
    }

    .content {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 1;
        padding: 2rem 0;
    }

    .card {
        background: rgba(22, 22, 42, 0.85);
        backdrop-filter: blur(15px);
        border: 1px solid rgba(102, 126, 234, 0.3);
        border-radius: 30px;
        overflow: hidden;
        box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 0 100px rgba(102, 126, 234, 0.2),
            inset 0 0 20px rgba(255, 255, 255, 0.05);
        position: relative;
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .card:hover {
        transform: translateY(-10px);
        box-shadow: 
            0 30px 80px rgba(0, 0, 0, 0.6),
            0 0 150px rgba(102, 126, 234, 0.3),
            inset 0 0 30px rgba(255, 255, 255, 0.1);
    }

    .card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, 
            transparent, 
            var(--accent-primary), 
            var(--accent-secondary), 
            transparent);
        animation: borderGlow 3s ease-in-out infinite;
    }

    @keyframes borderGlow {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
    }

    .card-header {
        background: linear-gradient(135deg, 
            rgba(102, 126, 234, 0.2) 0%, 
            rgba(118, 75, 162, 0.2) 100%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding: 3rem 2rem;
        text-align: center;
        position: relative;
        overflow: hidden;
    }

    .card-header::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
        animation: pulse 4s ease-in-out infinite;
        transform: translate(-50%, -50%);
    }

    @keyframes pulse {
        0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .card-title {
        font-size: 2.8rem;
        font-weight: 800;
        background: linear-gradient(45deg, 
            #ffffff, 
            var(--accent-primary), 
            #ffffff);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        margin-bottom: 0.5rem;
    }

    .card-title i {
        font-size: 2.5rem;
        animation: spin 10s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .card-subtitle {
        color: var(--text-secondary);
        font-size: 1.1rem;
        font-weight: 300;
        letter-spacing: 1px;
    }

    .card-body {
        padding: 4rem 3rem;
    }

    .form-group {
        margin-bottom: 2.5rem;
    }

    .form-label {
        color: var(--text-primary);
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .form-label i {
        color: var(--accent-primary);
        font-size: 1.2rem;
    }

    .input-wrapper {
        position: relative;
    }

    #search_value {
        background: rgba(26, 26, 46, 0.8);
        border: 2px solid rgba(102, 126, 234, 0.3);
        border-radius: 25px;
        color: var(--text-primary);
        font-size: 1.3rem;
        padding: 1.5rem 3rem 1.5rem 4rem;
        width: 100%;
        transition: all 0.3s ease;
        box-shadow: 
            inset 0 2px 10px rgba(0, 0, 0, 0.3),
            0 5px 20px rgba(102, 126, 234, 0.1);
    }

    #search_value:focus {
        outline: none;
        border-color: var(--accent-primary);
        box-shadow: 
            inset 0 2px 10px rgba(0, 0, 0, 0.3),
            0 5px 30px rgba(102, 126, 234, 0.3),
            0 0 0 3px rgba(102, 126, 234, 0.1);
        transform: translateY(-2px);
    }

    #search_value::placeholder {
        color: var(--text-muted);
    }

    .input-icon {
        position: absolute;
        left: 1.5rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--accent-primary);
        font-size: 1.3rem;
        z-index: 2;
    }

    .input-hint {
        color: var(--text-secondary);
        font-size: 0.9rem;
        text-align: center;
        margin-top: 0.8rem;
        padding: 0 1rem;
    }

    .submit-btn {
        background: linear-gradient(135deg, 
            var(--accent-primary) 0%, 
            var(--accent-secondary) 100%);
        border: none;
        border-radius: 25px;
        color: white;
        font-size: 1.2rem;
        font-weight: 600;
        padding: 1.2rem 3rem;
        width: 100%;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        box-shadow: 
            0 10px 30px rgba(102, 126, 234, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    }

    .submit-btn:hover {
        transform: translateY(-5px);
        box-shadow: 
            0 20px 40px rgba(102, 126, 234, 0.6),
            0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    }

    .submit-btn:active {
        transform: translateY(-2px);
    }

    .submit-btn::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: linear-gradient(45deg, 
            transparent 30%, 
            rgba(255, 255, 255, 0.1) 50%, 
            transparent 70%);
        transform: rotate(45deg);
        animation: shine 3s infinite linear;
    }

    @keyframes shine {
        0% { transform: translateX(-100%) rotate(45deg); }
        100% { transform: translateX(100%) rotate(45deg); }
    }

    .submit-btn i {
        margin-right: 0.8rem;
        font-size: 1.3rem;
    }

    /* Examples section */
    .examples {
        background: rgba(26, 26, 46, 0.5);
        border-radius: 20px;
        padding: 2rem;
        margin-top: 3rem;
        border: 1px solid rgba(102, 126, 234, 0.2);
        text-align: center;
    }

    .examples-title {
        color: var(--text-primary);
        font-size: 1.2rem;
        font-weight: 600;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }

    .examples-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-top: 1.5rem;
    }

    .example-item {
        background: rgba(102, 126, 234, 0.1);
        border: 1px solid rgba(102, 126, 234, 0.3);
        border-radius: 15px;
        padding: 1.2rem;
        transition: all 0.3s ease;
        cursor: pointer;
        position: relative;
        overflow: hidden;
    }

    .example-item:hover {
        transform: translateY(-5px);
        background: rgba(102, 126, 234, 0.2);
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.2);
    }

    .example-item::before {
        content: 'Try this';
        position: absolute;
        top: -10px;
        right: -10px;
        background: var(--accent-success);
        color: white;
        font-size: 0.7rem;
        padding: 3px 10px;
        border-radius: 10px;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
    }

    .example-item:hover::before {
        opacity: 1;
        transform: translateY(0);
    }

    .example-type {
        color: var(--accent-primary);
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .example-code {
        color: var(--text-primary);
        font-family: 'Courier New', monospace;
        font-size: 1.3rem;
        font-weight: 700;
        letter-spacing: 1px;
        background: rgba(0, 0, 0, 0.3);
        padding: 0.8rem;
        border-radius: 10px;
        margin-top: 0.5rem;
    }

    /* Status indicators */
    .status-indicators {
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin-top: 3rem;
        padding-top: 3rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .status-item {
        text-align: center;
        color: var(--text-secondary);
        font-size: 0.9rem;
        transition: all 0.3s ease;
    }

    .status-item:hover {
        color: var(--text-primary);
        transform: translateY(-5px);
    }

    .status-icon {
        display: block;
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }

    .status-icon.received { color: var(--accent-primary); }
    .status-icon.in-progress { color: var(--accent-warning); }
    .status-icon.completed { color: var(--accent-success); }

    /* Scanner effect */
    .scanner-line {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 4px;
        background: linear-gradient(90deg, 
            transparent, 
            var(--accent-primary), 
            transparent);
        animation: scan 2s ease-in-out infinite;
        opacity: 0.5;
    }

    @keyframes scan {
        0% { top: 0; }
        100% { top: 100%; }
    }

    /* Responsive */
    @media (max-width: 768px) {
        .card-title {
            font-size: 2rem;
        }
        
        .card-body {
            padding: 2rem 1.5rem;
        }
        
        #search_value {
            font-size: 1.1rem;
            padding: 1.2rem 3rem 1.2rem 3.5rem;
        }
        
        .examples-grid {
            grid-template-columns: 1fr;
        }
        
        .status-indicators {
            flex-direction: column;
            gap: 1rem;
        }
    }
</style>

<!-- Floating Background Elements -->
<div class="floating-element"></div>
<div class="floating-element"></div>

<div class="content py-5">
    <div class="container-fluid">
        <div class="row justify-content-center">
            <div class="col-lg-6 col-md-8 col-sm-12">
                <!-- Scanner Line -->
                <div class="scanner-line"></div>
                
                <div class="card shadow-lg">
                    <!-- Header -->
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fa fa-search"></i>
                            Track Your Job Status
                        </h3>
                        <p class="card-subtitle">Enter your unique identifier below</p>
                    </div>

                    <div class="card-body">
                        <form id="check_status_form">
                            <div class="form-group">
                                <label class="form-label">
                                    <i class="fa fa-fingerprint"></i>
                                    Job Identifier
                                </label>
                                <div class="input-wrapper">
                                    <i class="fa fa-hashtag input-icon"></i>
                                    <input type="text" 
                                           name="search_value" 
                                           id="search_value"
                                           class="form-control"
                                           placeholder="Enter Job No. or Repair Code"
                                           autofocus 
                                           required>
                                </div>
                                <div class="input-hint">
                                    You can enter either Job Number or Repair Code
                                </div>
                            </div>

                            <div class="text-center mt-4">
                                <button type="submit" class="submit-btn">
                                    <i class="fa fa-search"></i>
                                    Track Status
                                </button>
                            </div>
                        </form>

                        <!-- Examples Section -->
                        <div class="examples">
                            <div class="examples-title">
                                <i class="fa fa-lightbulb"></i>
                                Quick Examples
                            </div>
                            <p class="text-muted mb-0">Try clicking on any example below</p>
                            
                            <div class="examples-grid">
                                <div class="example-item" data-value="27269">
                                    <div class="example-type">
                                        <i class="fa fa-briefcase"></i>
                                        Job Number
                                    </div>
                                    <div class="example-code">27269</div>
                                </div>
                                <div class="example-item" data-value="2025102404">
                                    <div class="example-type">
                                        <i class="fa fa-code"></i>
                                        Repair Code
                                    </div>
                                    <div class="example-code">2025102404</div>
                                </div>
                                <div class="example-item" data-value="29845">
                                    <div class="example-type">
                                        <i class="fa fa-briefcase"></i>
                                        Job Number
                                    </div>
                                    <div class="example-code">29845</div>
                                </div>
                            </div>
                        </div>

                        <!-- Status Indicators -->
                        <div class="status-indicators">
                            <div class="status-item">
                                <i class="fa fa-inbox status-icon received"></i>
                                <div>Received</div>
                            </div>
                            <div class="status-item">
                                <i class="fa fa-tools status-icon in-progress"></i>
                                <div>In Progress</div>
                            </div>
                            <div class="status-item">
                                <i class="fa fa-check-circle status-icon completed"></i>
                                <div>Completed</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Enhanced JavaScript with Magic Effects -->
<script>
$(function(){
    // Initialize with sound effects
    const clickSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3');
    const successSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3');
    
    // Click example items
    $('.example-item').click(function(){
        const value = $(this).data('value');
        $('#search_value').val(value);
        
        // Visual feedback
        $(this).css({
            'transform': 'scale(0.95)',
            'background': 'rgba(102, 126, 234, 0.3)'
        });
        
        setTimeout(() => {
            $(this).css({
                'transform': 'scale(1)',
                'background': 'rgba(102, 126, 234, 0.1)'
            });
        }, 300);
        
        // Play sound
        clickSound.currentTime = 0;
        clickSound.play().catch(e => console.log("Audio play failed:", e));
        
        // Animate input
        $('#search_value').animate({
            backgroundColor: 'rgba(102, 126, 234, 0.3)'
        }, 200).animate({
            backgroundColor: 'rgba(26, 26, 46, 0.8)'
        }, 200);
    });

    // Form submission with enhanced effects
    $('#check_status_form').submit(function(e){
        e.preventDefault();
        var value = $('#search_value').val().trim();

        if(value === ''){
            // Shake animation for empty input
            $('#search_value').css('border-color', '#ef4444');
            $('#search_value').effect('shake', { distance: 10, times: 3 }, 300);
            
            setTimeout(() => {
                $('#search_value').css('border-color', 'rgba(102, 126, 234, 0.3)');
            }, 1000);
            
            showToast('Please enter Job No. or Repair Code', 'warning');
            return;
        }

        // Add loading effect to button
        const $btn = $(this).find('button[type="submit"]');
        const originalText = $btn.html();
        $btn.html('<i class="fa fa-spinner fa-spin"></i> Processing...');
        $btn.prop('disabled', true);

        // Play sound
        successSound.currentTime = 0;
        successSound.play().catch(e => console.log("Audio play failed:", e));

        // Add particle effect
        createParticles($btn[0]);

        // Delay for effect before redirecting
        setTimeout(() => {
            // Detect if it's Job No. or Repair Code
            if(/^\d{4,6}$/.test(value)){
                // Job No. (4-6 digits)
                window.location.href = "./?p=job_status&job_id=" + encodeURIComponent(value);
            } else if(/^\d{10}$/.test(value)) {
                // Repair Code (10 digits)
                window.location.href = "./?p=view_status&code=" + encodeURIComponent(value);
            } else {
                // Invalid format
                $btn.html(originalText);
                $btn.prop('disabled', false);
                showToast('Invalid format. Please enter a valid Job No. (4-6 digits) or Repair Code (10 digits)', 'error');
                $('#search_value').effect('shake', { distance: 10, times: 3 }, 300);
            }
        }, 1500);
    });

    // Input validation with visual feedback
    $('#search_value').on('input', function(){
        const value = $(this).val().trim();
        
        if(/^\d{4,6}$/.test(value)) {
            // Valid Job No.
            $(this).css({
                'border-color': 'var(--accent-success)',
                'box-shadow': '0 0 20px rgba(16, 185, 129, 0.3)'
            });
        } else if(/^\d{10}$/.test(value)) {
            // Valid Repair Code
            $(this).css({
                'border-color': 'var(--accent-primary)',
                'box-shadow': '0 0 20px rgba(102, 126, 234, 0.3)'
            });
        } else if(value.length > 0) {
            // Invalid but has content
            $(this).css({
                'border-color': 'var(--accent-warning)',
                'box-shadow': '0 0 20px rgba(245, 158, 11, 0.2)'
            });
        } else {
            // Empty
            $(this).css({
                'border-color': 'rgba(102, 126, 234, 0.3)',
                'box-shadow': 'none'
            });
        }
    });

    // Add keyboard shortcuts
    $(document).on('keydown', function(e){
        // Ctrl/Cmd + / to focus search
        if((e.ctrlKey || e.metaKey) && e.key === '/'){
            e.preventDefault();
            $('#search_value').focus().select();
        }
        
        // Enter to submit if focused
        if(e.key === 'Enter' && $('#search_value').is(':focus')){
            $('#check_status_form').submit();
        }
    });

    // Particle effect function
    function createParticles(element){
        const rect = element.getBoundingClientRect();
        const particleCount = 20;
        
        for(let i = 0; i < particleCount; i++){
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.width = '4px';
            particle.style.height = '4px';
            particle.style.background = getRandomGradient();
            particle.style.borderRadius = '50%';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '9999';
            particle.style.left = (rect.left + rect.width/2) + 'px';
            particle.style.top = (rect.top + rect.height/2) + 'px';
            
            document.body.appendChild(particle);
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = 2 + Math.random() * 3;
            const life = 800 + Math.random() * 400;
            
            const animation = particle.animate([
                {
                    transform: 'translate(0, 0) scale(1)',
                    opacity: 1
                },
                {
                    transform: `translate(${Math.cos(angle) * velocity * 50}px, ${Math.sin(angle) * velocity * 50}px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: life,
                easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)'
            });
            
            animation.onfinish = () => particle.remove();
        }
    }

    function getRandomGradient(){
        const gradients = [
            'linear-gradient(135deg, #667eea, #764ba2)',
            'linear-gradient(135deg, #f093fb, #f5576c)',
            'linear-gradient(135deg, #4facfe, #00f2fe)',
            'linear-gradient(135deg, #43e97b, #38f9d7)'
        ];
        return gradients[Math.floor(Math.random() * gradients.length)];
    }

    function showToast(message, type = 'info'){
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-message ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#f59e0b' : '#10b981'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            z-index: 99999;
            transform: translateX(150%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            toast.style.transform = 'translateX(150%)';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // Add focus effect
    $('#search_value').on('focus', function(){
        $(this).parent().css('transform', 'scale(1.02)');
    });
    
    $('#search_value').on('blur', function(){
        $(this).parent().css('transform', 'scale(1)');
    });

    // Add tooltip for examples
    $('.example-item').tooltip({
        title: "Click to try this example",
        placement: "top",
        trigger: "hover"
    });

    // Add page load animation
    $(document).ready(function(){
        $('.card').css({
            'opacity': '0',
            'transform': 'translateY(50px)'
        });
        
        setTimeout(() => {
            $('.card').animate({
                opacity: 1,
                transform: 'translateY(0)'
            }, 800);
        }, 300);
    });
});
</script>