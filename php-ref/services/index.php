<style>
    :root {
        --bg-primary: #0a0a12;
        --bg-secondary: #1a1a2e;
        --bg-card: #16162a;
        --accent-primary: #667eea;
        --accent-secondary: #764ba2;
        --text-primary: #ffffff;
        --text-secondary: #b0b0c0;
        --text-muted: #6c757d;
        --border-color: #2a2a3e;
        --shadow-color: rgba(0, 0, 0, 0.4);
    }

    body {
        background: linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%);
        color: var(--text-primary);
        min-height: 100vh;
    }

    .section {
        position: relative;
        overflow: hidden;
        padding: 5rem 0;
    }

    .section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
        opacity: 0.5;
    }

    h3.text-center {
        font-size: 3rem;
        font-weight: 800;
        background: linear-gradient(45deg, var(--accent-primary), var(--accent-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        position: relative;
        display: inline-block;
        margin-bottom: 2rem;
    }

    h3.text-center::after {
        content: '';
        position: absolute;
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 100px;
        height: 4px;
        background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
        border-radius: 2px;
    }

    hr {
        border: none;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.3), transparent);
        margin: 3rem auto;
        width: 80%;
        opacity: 0.5;
    }

    /* Search Bar Styling */
    #search-field {
        position: relative;
        margin: 3rem auto;
        max-width: 800px;
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
        border-radius: 50px;
        overflow: hidden;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    #search-field:hover {
        transform: translateY(-5px);
        box-shadow: 0 25px 50px rgba(102, 126, 234, 0.2);
    }

    #search-field .form-control {
        background: rgba(22, 22, 42, 0.9);
        border: none;
        color: var(--text-primary);
        padding: 1.5rem 2rem;
        font-size: 1.2rem;
        font-weight: 400;
        letter-spacing: 0.5px;
        backdrop-filter: blur(10px);
    }

    #search-field .form-control::placeholder {
        color: var(--text-muted);
        opacity: 0.7;
    }

    #search-field .input-group-text {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        border: none;
        color: white;
        padding: 1.5rem 2.5rem;
        font-size: 1.2rem;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    #search-field .input-group-text:hover {
        background: linear-gradient(135deg, var(--accent-secondary), var(--accent-primary));
        padding-right: 3rem;
    }

    #search-field .input-group-text i {
        transition: transform 0.3s ease;
    }

    #search-field .input-group-text:hover i {
        transform: scale(1.2);
    }

    /* Accordion Styling */
    #serviceAccordion {
        max-width: 1000px;
        margin: 0 auto;
        position: relative;
    }

    #serviceAccordion .card {
        background: rgba(22, 22, 42, 0.8);
        border: none;
        border-radius: 15px;
        margin-bottom: 1rem;
        overflow: hidden;
        backdrop-filter: blur(10px);
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1);
        position: relative;
    }

    #serviceAccordion .card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100%;
        background: linear-gradient(90deg, rgba(102, 126, 234, 0.1), transparent);
        opacity: 0;
        transition: opacity 0.4s ease;
        pointer-events: none;
    }

    #serviceAccordion .card:hover {
        transform: translateX(10px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    #serviceAccordion .card:hover::before {
        opacity: 1;
    }

    #serviceAccordion .card-header {
        background: rgba(26, 26, 46, 0.6);
        border: none;
        padding: 0;
        position: relative;
        overflow: hidden;
    }

    #serviceAccordion .card-header::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, var(--accent-primary), transparent);
        opacity: 0.3;
    }

    #serviceAccordion .card-header h2 {
        margin: 0;
    }

    #serviceAccordion .card-header button {
        background: transparent;
        color: var(--text-primary);
        font-size: 1.3rem;
        font-weight: 600;
        padding: 1.5rem 2rem;
        width: 100%;
        text-align: left;
        border: none;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: all 0.3s ease;
        cursor: pointer;
    }

    #serviceAccordion .card-header button:hover {
        background: rgba(255, 255, 255, 0.05);
        padding-left: 2.5rem;
    }

    #serviceAccordion .card-header button[aria-expanded="true"] {
        background: linear-gradient(90deg, rgba(102, 126, 234, 0.1), transparent);
        color: var(--accent-primary);
    }

    #serviceAccordion .card-header button .d-flex {
        width: 100%;
    }

    .collapse-icon {
        font-size: 1.2rem;
        transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        min-width: 24px;
        text-align: center;
    }

    #serviceAccordion .card-header button[aria-expanded="true"] .collapse-icon {
        transform: rotate(180deg);
        -webkit-text-fill-color: var(--accent-secondary);
    }

    .card-body {
        background: rgba(30, 30, 50, 0.4);
        padding: 2rem;
        color: var(--text-secondary);
        line-height: 1.8;
        font-size: 1.05rem;
        border-top: 1px solid rgba(102, 126, 234, 0.1);
        animation: slideDown 0.5s ease-out;
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

    .service-description {
        white-space: pre-line;
        margin-bottom: 1.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .price-tag {
        display: inline-flex;
        align-items: center;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15));
        padding: 0.8rem 1.5rem;
        border-radius: 25px;
        font-weight: 700;
        color: var(--accent-primary);
        border: 1px solid rgba(102, 126, 234, 0.3);
        font-size: 1.1rem;
        transition: all 0.3s ease;
    }

    .price-tag:hover {
        transform: scale(1.05);
        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
        border-color: var(--accent-primary);
    }

    .price-tag .fa-tag {
        margin-right: 10px;
        color: var(--accent-secondary);
        font-size: 1.1rem;
    }

    /* Empty State */
    .no-services {
        text-align: center;
        padding: 5rem 1rem;
        background: rgba(22, 22, 42, 0.6);
        border-radius: 20px;
        margin-top: 3rem;
        border: 2px dashed rgba(102, 126, 234, 0.3);
    }

    .no-services i {
        font-size: 4rem;
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 1.5rem;
    }

    .no-services h4 {
        color: var(--text-primary);
        margin-bottom: 1rem;
        font-size: 1.5rem;
    }

    .no-services p {
        color: var(--text-muted);
        font-size: 1.1rem;
        max-width: 500px;
        margin: 0 auto;
    }

    /* Service Count Badge */
    .service-count-badge {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        color: white;
        padding: 0.8rem 1.5rem;
        border-radius: 25px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: pulse 2s infinite;
        cursor: pointer;
    }

    @keyframes pulse {
        0% {
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
        50% {
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.5);
        }
        100% {
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
    }

    .service-count-badge:hover {
        transform: translateY(-3px);
    }

    /* Animation for cards */
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    #serviceAccordion .card {
        animation: fadeInUp 0.6s ease forwards;
        opacity: 0;
    }

    #serviceAccordion .card:nth-child(1) { animation-delay: 0.1s; }
    #serviceAccordion .card:nth-child(2) { animation-delay: 0.2s; }
    #serviceAccordion .card:nth-child(3) { animation-delay: 0.3s; }
    #serviceAccordion .card:nth-child(4) { animation-delay: 0.4s; }
    #serviceAccordion .card:nth-child(5) { animation-delay: 0.5s; }
    #serviceAccordion .card:nth-child(6) { animation-delay: 0.6s; }

    /* Scroll to top button */
    .scroll-top {
        position: fixed;
        bottom: 90px;
        right: 30px;
        background: rgba(26, 26, 46, 0.8);
        border: 1px solid rgba(102, 126, 234, 0.3);
        color: var(--accent-primary);
        width: 45px;
        height: 45px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 999;
        backdrop-filter: blur(10px);
    }

    .scroll-top.show {
        opacity: 1;
    }

    .scroll-top:hover {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        color: white;
        transform: translateY(-3px);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        h3.text-center {
            font-size: 2.2rem;
        }
        
        #search-field .form-control {
            padding: 1.2rem 1.5rem;
            font-size: 1rem;
        }
        
        #search-field .input-group-text {
            padding: 1.2rem 1.8rem;
        }
        
        #serviceAccordion .card-header button {
            font-size: 1.1rem;
            padding: 1.2rem 1.5rem;
        }
        
        .service-count-badge {
            bottom: 20px;
            right: 20px;
            padding: 0.6rem 1.2rem;
            font-size: 0.9rem;
        }
        
        .scroll-top {
            bottom: 80px;
            right: 20px;
        }
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar {
        width: 8px;
    }

    ::-webkit-scrollbar-track {
        background: var(--bg-secondary);
    }

    ::-webkit-scrollbar-thumb {
        background: linear-gradient(var(--accent-primary), var(--accent-secondary));
        border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(var(--accent-secondary), var(--accent-primary));
    }
</style>

<div class="section py-5">
    <div class="container">
        <!-- Header -->
        <div class="text-center mb-5">
            <h3 class="text-center">Our Premium Services</h3>
            <p class="text-muted lead mb-0">Excellence delivered with every service</p>
        </div>

        <!-- Search Bar -->
        <div class="row justify-content-center">
            <div class="col-lg-9 col-md-11 col-sm-12 mb-4">
                <div class="input-group input-group-lg" id="search-field">
                    <input type="search" class="form-control" aria-label="Search Service Field" id="search" placeholder="What service are you looking for?">
                    <div class="input-group-append">
                        <span class="input-group-text"><i class="fa fa-search"></i></span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Services Accordion -->
        <div class="accordion" id="serviceAccordion">
            <?php 
            $services = $conn->query("SELECT * FROM `service_list` where delete_flag = 0 and `status` = 1 order by `name` asc");
            $serviceCount = 0;
            
            while($row = $services->fetch_assoc()):
                $serviceCount++;
            ?>
            <div class="card mb-3">
                <div class="card-header" id="service<?= $row['id'] ?>">
                    <h2 class="mb-0">
                        <button class="btn" type="button" data-toggle="collapse" data-target="#collapse<?= $row['id'] ?>" 
                                aria-expanded="false" aria-controls="collapse<?= $row['id'] ?>"
                                data-service-id="<?= $row['id'] ?>">
                            <div class="d-flex w-100 align-items-center justify-content-between">
                                <div class="service-title">
                                    <i class="fa fa-star text-warning mr-2" style="font-size: 0.9rem;"></i>
                                    <?= htmlspecialchars($row['name']) ?>
                                </div>
                                <i class="fa fa-chevron-down collapse-icon"></i>
                            </div>
                        </button>
                    </h2>
                </div>
                <div id="collapse<?= $row['id'] ?>" class="collapse service_collapse" 
                     aria-labelledby="service<?= $row['id'] ?>" data-parent="#serviceAccordion">
                    <div class="card-body">
                        <div class="service-description">
                            <?= nl2br(htmlspecialchars($row['description'])) ?>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="price-tag">
                                <span class="fa fa-tag"></span>
                                <span><?= format_num($row['price']) ?></span>
                            </div>
                            <button class="btn btn-sm" 
                                    style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); 
                                           color: var(--accent-primary); border: none; padding: 0.5rem 1.5rem; border-radius: 20px;"
                                    onclick="uni_modal('<i class=\'fa fa-calendar mr-2\'></i> Book Service', 'services/book_service.php?id=<?= $row['id'] ?>')">
                                <i class="fa fa-calendar mr-2"></i> Book Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <?php endwhile; ?>
            
            <!-- Empty State -->
            <?php if($serviceCount == 0): ?>
            <div class="no-services">
                <i class="fa fa-concierge-bell"></i>
                <h4>No Services Available</h4>
                <p>We're currently updating our service offerings. Please check back soon or contact us for custom solutions.</p>
            </div>
            <?php endif; ?>
        </div>

        <!-- Service Count Badge -->
        <?php if($serviceCount > 0): ?>
        <div class="service-count-badge" id="serviceCountBadge" onclick="scrollToServices()">
            <i class="fa fa-concierge-bell"></i>
            <span><?= $serviceCount ?> Service<?= $serviceCount > 1 ? 's' : '' ?> Available</span>
        </div>
        <?php endif; ?>

        <!-- Scroll to Top Button -->
        <div class="scroll-top" id="scrollTop" onclick="scrollToTop()">
            <i class="fa fa-arrow-up"></i>
        </div>
    </div>
</div>

<script>
    $(function(){
        let serviceCount = <?= $serviceCount ?>;
        
        // Initialize all collapses as closed
        $('.service_collapse').removeClass('show');
        
        // Accordion icon animation
        $('.service_collapse').on('show.bs.collapse', function(){
            var card = $(this).closest('.card');
            var icon = card.find('.collapse-icon');
            var button = card.find('[data-toggle="collapse"]');
            
            icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            button.attr('aria-expanded', 'true');
            
            // Add active class to card
            card.addClass('active');
            
            // Scroll the opened card into view
            setTimeout(() => {
                this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        });
        
        $('.service_collapse').on('hide.bs.collapse', function(){
            var card = $(this).closest('.card');
            var icon = card.find('.collapse-icon');
            var button = card.find('[data-toggle="collapse"]');
            
            icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
            button.attr('aria-expanded', 'false');
            
            // Remove active class from card
            card.removeClass('active');
        });

        // Enhanced search functionality
        $('#search').on('input', function(){
            var searchTerm = $(this).val().toLowerCase().trim();
            var hasResults = false;
            
            $('#serviceAccordion .card').each(function(){
                var cardText = $(this).text().toLowerCase();
                var card = $(this);
                
                if(cardText.includes(searchTerm)) {
                    card.show();
                    hasResults = true;
                    
                    // Highlight search term in title
                    if(searchTerm.length > 0) {
                        var title = card.find('.service-title');
                        var originalText = title.data('original') || title.text();
                        title.data('original', originalText);
                        
                        var highlighted = originalText.replace(
                            new RegExp(searchTerm, 'gi'),
                            match => `<mark style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3)); color: white; padding: 2px 4px; border-radius: 3px;">${match}</mark>`
                        );
                        title.html(highlighted);
                    }
                } else {
                    card.hide();
                    // Close if open
                    card.find('.service_collapse').collapse('hide');
                }
            });
            
            // Show no results message
            var $noResults = $('#no-results-message');
            if(!hasResults && searchTerm.length > 0) {
                if($noResults.length === 0) {
                    $('#serviceAccordion').append(`
                        <div id="no-results-message" class="no-services">
                            <i class="fa fa-search"></i>
                            <h4>No services found</h4>
                            <p>Try adjusting your search terms or browse all services</p>
                            <button class="btn mt-3" onclick="$('#search').val('').trigger('input')" 
                                    style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); 
                                           color: white; border: none; padding: 0.7rem 2rem; border-radius: 25px;">
                                <i class="fa fa-redo mr-2"></i> Clear Search
                            </button>
                        </div>
                    `);
                }
            } else {
                $noResults.remove();
                
                // Restore original titles if search is cleared
                if(searchTerm.length === 0) {
                    $('#serviceAccordion .service-title').each(function(){
                        var original = $(this).data('original');
                        if(original) {
                            $(this).text(original);
                            $(this).removeData('original');
                        }
                    });
                }
            }
            
            // Update service count badge
            if(searchTerm.length > 0) {
                var visibleCount = $('#serviceAccordion .card:visible').length;
                $('#serviceCountBadge span').html(`${visibleCount} Service${visibleCount !== 1 ? 's' : ''} Found`);
            } else {
                $('#serviceCountBadge span').html(`${serviceCount} Service${serviceCount > 1 ? 's' : ''} Available`);
            }
        });

        // Search input styling and focus
        $('#search')
            .attr('style', 'color: var(--text-primary);')
            .on('focus', function(){
                $(this).css({
                    'color': 'white',
                    'background': 'rgba(22, 22, 42, 1)'
                });
            })
            .on('blur', function(){
                if($(this).val() === ''){
                    $(this).css({
                        'color': 'var(--text-primary)',
                        'background': 'rgba(22, 22, 42, 0.9)'
                    });
                }
            });

        // Keyboard shortcut for search
        $(document).on('keydown', function(e){
            if((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                $('#search').focus();
            }
        });

        // Show keyboard shortcut hint
        $('#search').attr('title', 'Press Ctrl+K to focus search');

        // Scroll to top button functionality
        $(window).on('scroll', function() {
            if ($(this).scrollTop() > 300) {
                $('#scrollTop').addClass('show');
            } else {
                $('#scrollTop').removeClass('show');
            }
        });

        // Auto-open first service on page load if only one exists
        if(serviceCount === 1) {
            setTimeout(() => {
                $('#serviceAccordion .service_collapse').collapse('show');
            }, 500);
        }
    });

    function scrollToTop() {
        $('html, body').animate({ scrollTop: 0 }, 800);
    }

    function scrollToServices() {
        $('html, body').animate({ 
            scrollTop: $('#serviceAccordion').offset().top - 100 
        }, 800);
    }

    // Export all services functionality
    function exportServices() {
        // This would typically make an AJAX call to export services
        alert_toast("Exporting services... This feature would generate a PDF/CSV of all services.", "info");
    }
</script>