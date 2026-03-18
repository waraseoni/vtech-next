<?php
require_once('./../config.php');
if(isset($_GET['id']) && $_GET['id'] > 0){
    $qry = $conn->query("SELECT * from `product_list` where id = '{$_GET['id']}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){
            $$k=$v;
        }
    } else {
        echo "<script>alert('Product not found'); window.location.reload();</script>";
        exit;
    }
} else {
    echo "<script>alert('Invalid product ID'); window.location.reload();</script>";
    exit;
}

// Get related products
$related_qry = $conn->query("SELECT * FROM `product_list` 
    WHERE id != '{$id}' AND delete_flag = 0 AND status = 1 
    ORDER BY RAND() LIMIT 3");
?>
<style>
    :root {
        --modal-bg: #0f0f1a;
        --modal-card: #1a1a2e;
        --modal-accent: #667eea;
        --modal-secondary: #764ba2;
        --modal-text: #ffffff;
        --modal-muted: #a0a0b0;
        --modal-border: #2d2d3d;
    }

    #uni_modal .modal-content {
        background: linear-gradient(135deg, #0c0c14 0%, #1a1a2e 100%);
        border: 1px solid var(--modal-border);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    }

    #uni_modal .modal-header {
        background: rgba(26, 26, 46, 0.8);
        border-bottom: 1px solid rgba(102, 126, 234, 0.2);
        backdrop-filter: blur(10px);
        padding: 1.5rem;
    }

    #uni_modal .modal-title {
        background: linear-gradient(45deg, var(--modal-accent), var(--modal-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 700;
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    #uni_modal .modal-body {
        padding: 0;
        max-height: 80vh;
        overflow-y: auto;
    }

    #uni_modal .modal-body::-webkit-scrollbar {
        width: 6px;
    }

    #uni_modal .modal-body::-webkit-scrollbar-track {
        background: rgba(26, 26, 46, 0.5);
    }

    #uni_modal .modal-body::-webkit-scrollbar-thumb {
        background: linear-gradient(var(--modal-accent), var(--modal-secondary));
        border-radius: 3px;
    }

    #cimg {
        width: 100%;
        height: 300px;
        object-fit: cover;
        object-position: center center;
        transition: all 0.6s ease;
    }

    .image-container {
        position: relative;
        overflow: hidden;
        border-bottom: 3px solid var(--modal-accent);
    }

    .image-container:hover #cimg {
        transform: scale(1.05);
    }

    .product-badge {
        position: absolute;
        top: 15px;
        right: 15px;
        background: linear-gradient(135deg, var(--modal-accent), var(--modal-secondary));
        color: white;
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        z-index: 2;
    }

    .product-info {
        padding: 2rem;
    }

    .product-title {
        font-size: 2rem;
        font-weight: 700;
        color: var(--modal-text);
        margin-bottom: 1rem;
        line-height: 1.2;
        position: relative;
        padding-bottom: 10px;
    }

    .product-title::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 60px;
        height: 3px;
        background: linear-gradient(90deg, var(--modal-accent), var(--modal-secondary));
        border-radius: 2px;
    }

    .product-price {
        font-size: 2.5rem;
        font-weight: 800;
        color: var(--modal-accent);
        margin: 1.5rem 0;
        text-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .product-price::before {
        content: '₹';
        font-size: 1.5rem;
        opacity: 0.8;
    }

    .description-container {
        background: rgba(26, 26, 46, 0.5);
        border-radius: 15px;
        padding: 1.5rem;
        margin: 1.5rem 0;
        border: 1px solid var(--modal-border);
        transition: all 0.3s ease;
    }

    .description-container:hover {
        border-color: var(--modal-accent);
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }

    .description-title {
        color: var(--modal-text);
        font-weight: 600;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.2rem;
    }

    .description-title i {
        color: var(--modal-accent);
    }

    .product-description {
        color: var(--modal-muted);
        line-height: 1.8;
        font-size: 1rem;
        white-space: pre-line;
    }

    .product-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin: 2rem 0;
    }

    .meta-item {
        background: rgba(26, 26, 46, 0.5);
        border: 1px solid var(--modal-border);
        border-radius: 10px;
        padding: 1rem;
        transition: all 0.3s ease;
    }

    .meta-item:hover {
        border-color: var(--modal-accent);
        transform: translateY(-3px);
    }

    .meta-label {
        color: var(--modal-muted);
        font-size: 0.9rem;
        margin-bottom: 5px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .meta-label i {
        color: var(--modal-accent);
        width: 16px;
    }

    .meta-value {
        color: var(--modal-text);
        font-weight: 500;
        font-size: 1.1rem;
    }

    .product-actions {
        display: flex;
        gap: 1rem;
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 1px solid var(--modal-border);
    }

    .btn-close-modal {
        background: linear-gradient(135deg, #2d2d3d, #1a1a2e);
        border: 1px solid var(--modal-border);
        color: var(--modal-text);
        padding: 10px 25px;
        border-radius: 25px;
        font-weight: 500;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .btn-close-modal:hover {
        background: linear-gradient(135deg, #3a3a4d, #2d2d3d);
        border-color: var(--modal-accent);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
    }

    .btn-wishlist {
        background: linear-gradient(135deg, var(--modal-accent), var(--modal-secondary));
        border: none;
        color: white;
        padding: 10px 25px;
        border-radius: 25px;
        font-weight: 500;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .btn-wishlist:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    /* Related Products */
    .related-products {
        background: rgba(26, 26, 46, 0.3);
        padding: 2rem;
        margin-top: 2rem;
        border-top: 1px solid var(--modal-border);
    }

    .section-title {
        color: var(--modal-text);
        font-size: 1.3rem;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .section-title i {
        color: var(--modal-accent);
    }

    .related-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }

    .related-item {
        background: rgba(26, 26, 46, 0.5);
        border: 1px solid var(--modal-border);
        border-radius: 10px;
        overflow: hidden;
        transition: all 0.3s ease;
        cursor: pointer;
    }

    .related-item:hover {
        border-color: var(--modal-accent);
        transform: translateY(-5px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }

    .related-image {
        width: 100%;
        height: 120px;
        object-fit: cover;
    }

    .related-info {
        padding: 1rem;
    }

    .related-name {
        color: var(--modal-text);
        font-weight: 500;
        font-size: 0.9rem;
        margin-bottom: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .related-price {
        color: var(--modal-accent);
        font-weight: 600;
        font-size: 0.9rem;
    }

    /* Animations */
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideIn {
        from { transform: translateX(-20px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    .animate-fadeIn {
        animation: fadeIn 0.6s ease forwards;
    }

    .animate-slideIn {
        animation: slideIn 0.4s ease forwards;
    }

    .delay-1 { animation-delay: 0.1s; }
    .delay-2 { animation-delay: 0.2s; }
    .delay-3 { animation-delay: 0.3s; }

    /* Responsive */
    @media (max-width: 768px) {
        .product-price {
            font-size: 2rem;
        }
        
        .product-title {
            font-size: 1.5rem;
        }
        
        .product-meta {
            grid-template-columns: 1fr;
        }
        
        .product-actions {
            flex-direction: column;
        }
        
        .related-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }
    }
</style>

<div class="container-fluid">
    <!-- Product Image -->
    <div class="image-container animate-fadeIn">
        <div class="product-badge">
            <i class="fa fa-star mr-1"></i> Featured
        </div>
        <img src="<?= validate_image(isset($image_path) ? $image_path : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80') ?>" 
             alt="<?= htmlspecialchars($name) ?>" 
             id="cimg" 
             class="img-fluid"
             onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'">
    </div>

    <!-- Product Info -->
    <div class="product-info">
        <h1 class="product-title animate-fadeIn">
            <?= isset($name) ? htmlspecialchars($name) : "Product Name" ?>
        </h1>

        <!-- Price -->
        <div class="product-price animate-slideIn delay-1">
            <?= isset($price) ? format_num($price) : "0.00" ?>
        </div>

        <!-- Description -->
        <div class="description-container animate-fadeIn delay-2">
            <div class="description-title">
                <i class="fa fa-align-left"></i>
                <span>Product Description</span>
            </div>
            <div class="product-description">
                <?= isset($description) ? nl2br(htmlspecialchars($description)) : "No description available." ?>
            </div>
        </div>

        <!-- Meta Information -->
        <div class="product-meta">
            <div class="meta-item animate-fadeIn delay-1">
                <div class="meta-label">
                    <i class="fa fa-barcode"></i>
                    <span>Product ID</span>
                </div>
                <div class="meta-value">#PROD<?= str_pad($id, 6, '0', STR_PAD_LEFT) ?></div>
            </div>
            
            <div class="meta-item animate-fadeIn delay-2">
                <div class="meta-label">
                    <i class="fa fa-layer-group"></i>
                    <span>Category</span>
                </div>
                <div class="meta-value"><?= isset($category_id) ? get_category_name($category_id) : "General" ?></div>
            </div>
            
            <div class="meta-item animate-fadeIn delay-3">
                <div class="meta-label">
                    <i class="fa fa-chart-line"></i>
                    <span>Status</span>
                </div>
                <div class="meta-value">
                    <span class="badge" style="background: linear-gradient(135deg, var(--modal-accent), var(--modal-secondary));">
                        <?= isset($status) && $status == 1 ? 'Available' : 'Out of Stock' ?>
                    </span>
                </div>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="product-actions animate-fadeIn">
            <button class="btn-wishlist">
                <i class="fa fa-heart"></i>
                <span>Add to Wishlist</span>
            </button>
            
            <button class="btn-close-modal" type="button" data-dismiss="modal">
                <i class="fa fa-times"></i>
                <span>Close</span>
            </button>
        </div>

        <!-- Related Products -->
        <?php if($related_qry->num_rows > 0): ?>
        <div class="related-products animate-fadeIn">
            <h3 class="section-title">
                <i class="fa fa-th-large"></i>
                <span>You Might Also Like</span>
            </h3>
            
            <div class="related-grid">
                <?php while($related = $related_qry->fetch_assoc()): ?>
                <div class="related-item" onclick="loadProduct(<?= $related['id'] ?>)">
                    <img src="<?= validate_image($related['image_path']) ?>" 
                         alt="<?= htmlspecialchars($related['name']) ?>" 
                         class="related-image"
                         onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'">
                    <div class="related-info">
                        <div class="related-name"><?= htmlspecialchars($related['name']) ?></div>
                        <div class="related-price"><?= format_num($related['price']) ?></div>
                    </div>
                </div>
                <?php endwhile; ?>
            </div>
        </div>
        <?php endif; ?>
    </div>
</div>

<script>
// Function to get category name (placeholder - you'll need to implement this)
function get_category_name(id) {
    // This should be replaced with actual category fetching logic
    const categories = {
        1: 'Electronics',
        2: 'Clothing',
        3: 'Books',
        4: 'Home & Kitchen',
        5: 'Sports'
    };
    return categories[id] || 'General';
}

// Load another product in the modal
function loadProduct(id) {
    start_loader();
    $.ajax({
        url: "products/view_product.php?id=" + id,
        method: 'GET',
        success: function(resp) {
            $('#uni_modal .modal-content').html(resp);
            end_loader();
        },
        error: function(err) {
            console.log(err);
            alert_toast("Failed to load product", 'error');
            end_loader();
        }
    });
}

// Add to wishlist functionality
$(document).ready(function() {
    $('.btn-wishlist').click(function() {
        const $btn = $(this);
        const productId = <?= $id ?>;
        
        $btn.html('<i class="fa fa-spinner fa-spin"></i> <span>Adding...</span>');
        
        setTimeout(() => {
            $btn.html('<i class="fa fa-check"></i> <span>Added to Wishlist</span>');
            $btn.css({
                'background': 'linear-gradient(135deg, #28a745, #20c997)'
            });
            
            setTimeout(() => {
                $btn.html('<i class="fa fa-heart"></i> <span>Add to Wishlist</span>');
                $btn.css({
                    'background': 'linear-gradient(135deg, var(--modal-accent), var(--modal-secondary))'
                });
            }, 2000);
        }, 500);
    });

    // Image zoom on click
    $('#cimg').click(function() {
        const src = $(this).attr('src');
        uni_modal('<i class="fa fa-expand"></i> Image Preview', 
            `<div class="text-center"><img src="${src}" class="img-fluid" style="max-height: 80vh;"></div>`,
            'modal-lg');
    });
});
</script>