<style>
    :root {
        --bg-primary: #0f0f1a;
        --bg-secondary: #1a1a2e;
        --bg-card: #1e1e2d;
        --accent-primary: #667eea;
        --accent-secondary: #764ba2;
        --text-primary: #ffffff;
        --text-secondary: #b0b0c0;
        --text-muted: #6c757d;
        --border-color: #2d2d3d;
        --shadow-color: rgba(0, 0, 0, 0.3);
    }

    body {
        background: linear-gradient(135deg, #0c0c14 0%, #1a1a2e 100%);
        color: var(--text-primary);
        min-height: 100vh;
    }

    .section {
        position: relative;
        overflow: hidden;
    }

    .section::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at 70% 30%, rgba(102, 126, 234, 0.1) 0%, transparent 50%);
        z-index: 0;
    }

    h3.text-center {
        position: relative;
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 1.5rem;
        background: linear-gradient(45deg, var(--accent-primary), var(--accent-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 2px 10px rgba(102, 126, 234, 0.2);
    }

    hr {
        border: none;
        height: 2px;
        background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
        width: 60%;
        margin: 2rem auto;
        opacity: 0.7;
    }

    #search-field {
        position: relative;
        margin: 2rem 0;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        border-radius: 50px;
        overflow: hidden;
        transition: all 0.3s ease;
    }

    #search-field:hover {
        box-shadow: 0 15px 40px rgba(102, 126, 234, 0.2);
        transform: translateY(-2px);
    }

    #search-field .form-control {
        background: rgba(30, 30, 45, 0.9);
        border: none;
        color: var(--text-primary);
        padding: 1.2rem 1.5rem;
        font-size: 1.1rem;
        backdrop-filter: blur(10px);
    }

    #search-field .form-control::placeholder {
        color: var(--text-muted);
        opacity: 0.8;
    }

    #search-field .input-group-text {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        border: none;
        color: white;
        padding: 1.2rem 2rem;
        font-size: 1.1rem;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    #search-field .input-group-text:hover {
        background: linear-gradient(135deg, var(--accent-secondary), var(--accent-primary));
    }

    .card {
        background: rgba(30, 30, 45, 0.8);
        border: 1px solid rgba(45, 45, 61, 0.5);
        border-radius: 15px;
        overflow: hidden;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1);
        backdrop-filter: blur(10px);
        position: relative;
        z-index: 1;
    }

    .card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
        opacity: 0;
        transition: opacity 0.4s ease;
    }

    .card:hover {
        transform: translateY(-10px) scale(1.02);
        border-color: rgba(102, 126, 234, 0.3);
        box-shadow: 0 20px 40px rgba(102, 126, 234, 0.2);
    }

    .card:hover::before {
        opacity: 1;
    }

    .card-image-top-holder {
        position: relative;
        overflow: hidden;
        height: 220px;
    }

    .card-image-top {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: all 0.6s ease;
    }

    .card:hover .card-image-top {
        transform: scale(1.15);
    }

    .card-body {
        padding: 1.5rem;
    }

    .card-title {
        font-size: 1.3rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.8rem;
        line-height: 1.4;
    }

    .truncate-3 {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        color: var(--text-secondary);
        font-size: 0.95rem;
        line-height: 1.5;
        margin-bottom: 1rem;
        min-height: 4.5rem;
    }

    .price-tag {
        display: inline-flex;
        align-items: center;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-weight: 600;
        color: var(--accent-primary);
        border: 1px solid rgba(102, 126, 234, 0.2);
    }

    .fa-tag {
        margin-right: 8px;
        color: var(--accent-secondary);
    }

    .read-more {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        border: none;
        border-radius: 25px;
        padding: 0.8rem 2rem;
        font-weight: 500;
        letter-spacing: 0.5px;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    }

    .read-more:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    .read-more::after {
        content: '→';
        position: absolute;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0;
        transition: all 0.3s ease;
    }

    .read-more:hover::after {
        opacity: 1;
        right: 15px;
    }

    .no-products {
        text-align: center;
        padding: 5rem 1rem;
    }

    .no-products i {
        font-size: 4rem;
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 1.5rem;
    }

    .no-products h4 {
        color: var(--text-primary);
        margin-bottom: 1rem;
    }

    .no-products p {
        color: var(--text-muted);
        font-size: 1.1rem;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .col-lg-4 {
        animation: fadeInUp 0.5s ease forwards;
        opacity: 0;
    }

    .col-lg-4:nth-child(1) { animation-delay: 0.1s; }
    .col-lg-4:nth-child(2) { animation-delay: 0.2s; }
    .col-lg-4:nth-child(3) { animation-delay: 0.3s; }
    .col-lg-4:nth-child(4) { animation-delay: 0.4s; }
    .col-lg-4:nth-child(5) { animation-delay: 0.5s; }
    .col-lg-4:nth-child(6) { animation-delay: 0.6s; }

    /* Scrollbar Styling */
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

    /* Selection Color */
    ::selection {
        background: rgba(102, 126, 234, 0.5);
        color: white;
    }
</style>

<div class="section py-5">
    <div class="container">
        <!-- Header -->
        <div class="text-center mb-5">
            <h3>Our Premium Products</h3>
            <p class="text-muted lead mb-0">Discover excellence in every detail</p>
        </div>

        <!-- Search Bar -->
        <div class="row justify-content-center">
            <div class="col-lg-8 col-md-10 col-sm-12 mb-4">
                <div class="input-group input-group-lg" id="search-field">
                    <input type="search" class="form-control" aria-label="Search products" id="search" placeholder="Find your perfect product...">
                    <div class="input-group-append">
                        <span class="input-group-text"><i class="fa fa-search"></i></span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Product Grid -->
        <div class="row g-4" id="product-list">
            <?php 
            $products = $conn->query("SELECT * FROM `product_list` where delete_flag = 0 and `status` = 1 order by `name` asc");
            $productCount = 0;
            
            while($row = $products->fetch_assoc()):
                $productCount++;
            ?>
            <div class="col-lg-4 col-md-6 col-sm-12">
                <div class="card h-100">
                    <!-- Product Image -->
                    <div class="card-image-top-holder">
                        <img src="<?= validate_image($row['image_path']) ?>" class="card-image-top" 
                             alt="<?= htmlspecialchars($row['name']) ?>" 
                             onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'">
                    </div>
                    
                    <!-- Product Info -->
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title"><?= htmlspecialchars($row['name']) ?></h5>
                        <p class="truncate-3 flex-grow-1">
                            <?= nl2br(htmlspecialchars($row['description'])) ?>
                        </p>
                        
                        <div class="d-flex justify-content-between align-items-center mt-auto pt-3">
                            <div class="price-tag">
                                <span class="fa fa-tag"></span>
                                <span><?= format_num($row['price']) ?></span>
                            </div>
                            
                            <button class="btn read-more" data-id="<?= $row['id'] ?>" type="button">
                                <span>View Details</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <?php endwhile; ?>
            
            <!-- Empty State -->
            <?php if($productCount == 0): ?>
            <div class="col-12">
                <div class="no-products">
                    <i class="fa fa-box-open"></i>
                    <h4>No Products Available</h4>
                    <p>We're currently updating our collection. Please check back soon!</p>
                </div>
            </div>
            <?php endif; ?>
        </div>

        <!-- Product Count Badge -->
        <?php if($productCount > 0): ?>
        <div class="text-center mt-5 pt-3">
            <span class="badge badge-pill" style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); padding: 0.8rem 2rem; font-size: 1rem;">
                <i class="fa fa-cube mr-2"></i> Showing <?= $productCount ?> product<?= $productCount > 1 ? 's' : '' ?>
            </span>
        </div>
        <?php endif; ?>
    </div>
</div>

<script>
    $(function(){
        // Product Details Modal
        $('.read-more').click(function(){
            uni_modal(
                `<i class='fa fa-info-circle mr-2'></i> Product Details`,
                "products/view_product.php?id=" + $(this).attr('data-id'),
                'modal-lg'
            );
        });

        // Search Functionality
        $('#search').on('input', function(){
            var searchTerm = $(this).val().toLowerCase().trim();
            var hasResults = false;
            
            $('#product-list .card').each(function(){
                var cardText = $(this).text().toLowerCase();
                var parentDiv = $(this).closest('.col-lg-4');
                
                if(cardText.includes(searchTerm)) {
                    parentDiv.show();
                    hasResults = true;
                    
                    // Highlight search term in card title
                    if(searchTerm.length > 0) {
                        var title = $(this).find('.card-title');
                        var originalText = title.data('original') || title.text();
                        title.data('original', originalText);
                        
                        var highlighted = originalText.replace(
                            new RegExp(searchTerm, 'gi'),
                            match => `<mark style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3)); color: white; padding: 2px 4px; border-radius: 3px;">${match}</mark>`
                        );
                        title.html(highlighted);
                    }
                } else {
                    parentDiv.hide();
                }
            });
            
            // Show no results message
            var $noResults = $('#no-results-message');
            if(!hasResults && searchTerm.length > 0) {
                if($noResults.length === 0) {
                    $('#product-list').append(`
                        <div id="no-results-message" class="col-12 text-center py-5">
                            <i class="fa fa-search fa-3x mb-3 text-muted"></i>
                            <h4>No products found</h4>
                            <p class="text-muted">Try adjusting your search terms</p>
                        </div>
                    `);
                }
            } else {
                $noResults.remove();
                
                // Restore original titles if search is cleared
                if(searchTerm.length === 0) {
                    $('#product-list .card-title').each(function(){
                        var original = $(this).data('original');
                        if(original) {
                            $(this).text(original);
                            $(this).removeData('original');
                        }
                    });
                }
            }
        });

        // Search input styling
        $('#search')
            .attr('style', 'color: var(--text-primary);')
            .on('focus', function(){
                $(this).css({
                    'color': 'white',
                    'background': 'rgba(30, 30, 45, 1)'
                });
            })
            .on('blur', function(){
                if($(this).val() === ''){
                    $(this).css({
                        'color': 'var(--text-primary)',
                        'background': 'rgba(30, 30, 45, 0.9)'
                    });
                }
            });

        // Add keyboard shortcut for search
        $(document).on('keydown', function(e){
            if(e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                $('#search').focus();
            }
        });

        // Show keyboard shortcut hint
        $('#search').attr('title', 'Press Ctrl+K to focus');
    });
</script>