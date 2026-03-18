<?php if($_settings->chk_flashdata('success')): ?>
<script>alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')</script>
<?php endif;?>
<style>
    .prod-img{ width: 50px; height: 50px; object-fit:cover; border-radius:5px; }
    .product-name{ font-weight: 600; color: #333; }
    
    /* टेबल बैलेंस के लिए */
    #product-list-table {
        table-layout: fixed;
        width: 100%;
    }
    #product-list-table th, #product-list-table td {
        word-wrap: break-word;
    }
    #product-list-table th:nth-child(1), #product-list-table td:nth-child(1) { width: 5%; }
    #product-list-table th:nth-child(2), #product-list-table td:nth-child(2) { width: 10%; text-align: center; }
    #product-list-table th:nth-child(3), #product-list-table td:nth-child(3) { width: 35%; }
    #product-list-table th:nth-child(4), #product-list-table td:nth-child(4) { width: 15%; }
    #product-list-table th:nth-child(5), #product-list-table td:nth-child(5) { width: 15%; text-align: center; }
    #product-list-table th:nth-child(6), #product-list-table td:nth-child(6) { width: 20%; text-align: center; }
    
    /* Export बटन्स - डेस्कटॉप के लिए */
    .desktop-export-buttons {
        display: flex;
        gap: 8px;
        margin-left: 10px;
    }
    .export-btn {
        padding: 5px 12px;
        border-radius: 4px;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.3s;
        text-decoration: none !important;
        cursor: pointer;
    }
    .export-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 3px 5px rgba(0,0,0,0.2);
    }
    .btn-print {
        background-color: #6c757d;
        color: white;
        border: 1px solid #6c757d;
    }
    .btn-pdf {
        background-color: #dc3545;
        color: white;
        border: 1px solid #dc3545;
    }
    .btn-excel {
        background-color: #28a745;
        color: white;
        border: 1px solid #28a745;
    }
    
    /* मोबाइल Export बटन्स */
    .mobile-export-buttons {
        display: none;
        justify-content: center;
        gap: 10px;
        margin-bottom: 15px;
        padding: 0 10px;
    }
    .mobile-export-btn {
        flex: 1;
        max-width: 110px;
        padding: 8px 10px;
        border-radius: 5px;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        transition: all 0.3s;
        text-decoration: none !important;
        cursor: pointer;
    }
    
    /* Print स्टाइल्स */
    @media print {
        .desktop-export-buttons,
        .mobile-export-buttons,
        .mobile-search-container,
        .status-filter-container,
        .product-card,
        .no-results {
            display: none !important;
        }
        
        .table-responsive,
        #product-list-table,
        #product-list-table * {
            display: block !important;
            visibility: visible !important;
        }
        
        #product-list-table {
            width: 100% !important;
            border-collapse: collapse !important;
            display: table !important;
        }
        
        #product-list-table thead {
            display: table-header-group !important;
        }
        
        #product-list-table tbody {
            display: table-row-group !important;
        }
        
        #product-list-table tr {
            display: table-row !important;
            page-break-inside: avoid !important;
        }
        
        #product-list-table th,
        #product-list-table td {
            display: table-cell !important;
            border: 1px solid #ddd !important;
            padding: 8px !important;
        }
        
        .card-header,
        .card-tools,
        .dataTables_length,
        .dataTables_filter,
        .dataTables_info,
        .dataTables_paginate,
        .btn-group,
        .dropdown-menu,
        .dropdown-toggle,
        .fa-print,
        .fa-file-pdf,
        .fa-file-excel,
        .fa-plus {
            display: none !important;
        }
        
        .card {
            border: none !important;
            box-shadow: none !important;
        }
        
        .card-body {
            padding: 0 !important;
        }
        
        .card-title {
            text-align: center !important;
            margin-bottom: 20px !important;
        }
        
        .card-header {
            display: block !important;
            border-bottom: 2px solid #000 !important;
            margin-bottom: 20px !important;
        }
        
        .card-header h3 {
            text-align: center !important;
            font-size: 20px !important;
        }
        
        .prod-img {
            width: 40px !important;
            height: 40px !important;
        }
        
        @page {
            margin: 0.5cm;
        }
        
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif !important;
            font-size: 12px !important;
            color: #000 !important;
            background: #fff !important;
        }
        
        .print-date {
            text-align: right;
            font-size: 10px;
            color: #666;
            margin-bottom: 10px;
        }
    }
    
    /* मोबाइल स्टाइल्स */
    @media (max-width: 768px) {
        /* टेबल छुपाएं, कार्ड दिखाएं */
        #product-list-table { display: none !important; }
        .card-view { display: block !important; }
        
        /* डेस्कटॉप बटन्स छुपाएं */
        .desktop-export-buttons { display: none !important; }
        
        /* मोबाइल बटन्स दिखाएं */
        .mobile-export-buttons {
            display: flex !important;
        }
        
        /* मोबाइल सर्च बार */
        .mobile-search-container {
            margin-bottom: 15px;
            padding: 0 10px;
            position: relative;
        }
        .mobile-search-input {
            width: 100%;
            padding: 12px 45px 12px 15px;
            border: 1px solid #ddd;
            border-radius: 25px;
            font-size: 0.95rem;
            background: #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .mobile-search-input:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
        }
        .mobile-search-btn {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #6c757d;
            font-size: 1.2rem;
            padding: 5px 15px;
        }
        .mobile-search-clear {
            position: absolute;
            right: 55px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #dc3545;
            font-size: 1.2rem;
            padding: 5px;
            display: none;
            cursor: pointer;
        }
        .mobile-search-info {
            text-align: center;
            padding: 10px;
            font-size: 0.9rem;
            color: #6c757d;
            display: none;
        }
        
        /* स्टेटस फिल्टर */
        .status-filter-container {
            display: flex;
            justify-content: space-between;
            margin: 0 10px 15px 10px;
            gap: 5px;
        }
        .status-filter-btn {
            flex: 1;
            padding: 8px 5px;
            border: 1px solid #dee2e6;
            background: #fff;
            color: #495057;
            font-size: 0.85rem;
            border-radius: 5px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
        }
        .status-filter-btn.active {
            background: #007bff;
            color: white;
            border-color: #007bff;
        }
        .status-filter-btn:hover {
            background: #f8f9fa;
        }
        
        /* प्रोडक्ट कार्ड्स */
        .product-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            margin: 0 10px 15px 10px;
            padding: 15px;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        .product-card.hidden {
            display: none !important;
        }
        .product-card.inactive {
            opacity: 0.7;
            border-left: 4px solid #dc3545;
        }
        .product-card.active {
            border-left: 4px solid #28a745;
        }
        .product-card img {
            width: 100%;
            height: 180px;
            object-fit: cover;
            border-radius: 5px;
            margin-bottom: 10px;
        }
        
        /* कार्ड में बटन्स का अलाइनमेंट - FIXED */
        .product-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 15px;
            justify-content: space-between;
            align-items: center;
        }
        .product-actions .btn {
            flex: 1;
            min-width: 70px;
            text-align: center;
            padding: 6px 8px;
            font-size: 13px;
            margin: 2px;
        }
        .product-actions .text-muted {
            flex-basis: 100%;
            text-align: left;
            margin-bottom: 8px;
            font-size: 12px;
            color: #666 !important;
        }
        .product-actions .badge {
            font-size: 11px;
            padding: 3px 8px;
        }
        
        /* नो रिजल्ट */
        .no-results {
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
            font-size: 1.1rem;
            margin: 0 10px;
        }
        .no-results i {
            font-size: 3rem;
            color: #dee2e6;
            margin-bottom: 15px;
            display: block;
        }
    }
    
    /* डेस्कटॉप स्टाइल्स */
    @media (min-width: 769px) {
        .card-view,
        .mobile-search-container,
        .status-filter-container,
        .mobile-export-buttons {
            display: none !important;
        }
        .desktop-export-buttons {
            display: flex !important;
        }
    }
</style>
<div class="card card-outline card-navy shadow">
    <div class="card-header">
        <h3 class="card-title"><b><i class="fas fa-list text-navy"></i> List of Products</b></h3>
        <div class="card-tools d-flex align-items-center">
            <!-- डेस्कटॉप एक्सपोर्ट बटन्स -->
            <div class="desktop-export-buttons">
                <button type="button" class="export-btn btn-print" id="printBtn">
                    <i class="fas fa-print"></i> Print
                </button>
                <button type="button" class="export-btn btn-pdf" id="pdfBtn">
                    <i class="fas fa-file-pdf"></i> PDF
                </button>
                <button type="button" class="export-btn btn-excel" id="excelBtn">
                    <i class="fas fa-file-excel"></i> Excel
                </button>
            </div>
            <a href="javascript:void(0)" id="create_new" class="btn btn-flat btn-sm btn-primary"><span class="fas fa-plus"></span> Add New Product</a>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            <!-- Print Header -->
            <div class="print-date" style="display: none;">
                Printed on: <?php echo date('Y-m-d H:i:s'); ?>
            </div>
            
            <!-- मोबाइल एक्सपोर्ट बटन्स -->
            <div class="mobile-export-buttons">
                <button type="button" class="mobile-export-btn btn-print" id="mobilePrintBtn">
                    <i class="fas fa-print"></i> Print
                </button>
                <button type="button" class="mobile-export-btn btn-pdf" id="mobilePdfBtn">
                    <i class="fas fa-file-pdf"></i> PDF
                </button>
                <button type="button" class="mobile-export-btn btn-excel" id="mobileExcelBtn">
                    <i class="fas fa-file-excel"></i> Excel
                </button>
            </div>
            
            <!-- डेस्कटॉप/टैबलेट के लिए टेबल -->
            <div class="table-responsive">
                <table class="table table-hover table-striped table-bordered" id="product-list-table">
                    <thead>
                        <tr class="bg-navy">
                            <th class="text-center">#</th>
                            <th>Image</th>
                            <th>Product Name</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th class="text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $i = 1;
                        $qry = $conn->query("SELECT * FROM `product_list` WHERE delete_flag = 0 ORDER BY name ASC");
                        while($row = $qry->fetch_assoc()):
                        ?>
                            <tr>
                                <td class="text-center"><?php echo $i++; ?></td>
                                <td class="text-center">
                                    <img class="prod-img border shadow-sm" src="<?= validate_image($row['image_path']) ?>" alt="" loading="lazy">
                                </td>
                                <td>
                                    <div class="product-name"><?php echo $row['name'] ?></div>
                                    <small class="text-muted truncate-1"><?php echo $row['description'] ?></small>
                                </td>
                                <td class="font-weight-bold text-primary">₹ <?php echo number_format($row['price'], 2) ?></td>
                                <td class="text-center">
                                    <?php if($row['status'] == 1): ?>
                                        <span class="badge badge-success px-3">Active</span>
                                    <?php else: ?>
                                        <span class="badge badge-danger px-3">Inactive</span>
                                    <?php endif; ?>
                                </td>
                                <td align="center">
                                     <div class="btn-group">
                                        <button type="button" class="btn btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">Action</button>
                                        <div class="dropdown-menu" role="menu">
                                          <a class="dropdown-item view_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-eye text-primary"></span> View</a>
                                          <div class="dropdown-divider"></div>
                                          <a class="dropdown-item edit_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-edit text-info"></span> Edit</a>
                                          <div class="dropdown-divider"></div>
                                          <a class="dropdown-item delete_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>
            </div>

            <!-- मोबाइल के लिए कार्ड व्यू -->
            <div class="card-view">
                <!-- मोबाइल सर्च बार -->
                <div class="mobile-search-container">
                    <input type="text" class="mobile-search-input" id="mobileSearchInput" placeholder="Search products by name or description...">
                    <button type="button" class="mobile-search-clear" id="mobileSearchClear">
                        <i class="fas fa-times"></i>
                    </button>
                    <button type="button" class="mobile-search-btn" id="mobileSearchBtn">
                        <i class="fas fa-search"></i>
                    </button>
                    <div class="mobile-search-info" id="searchInfo">
                        Found <span id="resultCount">0</span> products
                    </div>
                </div>
                
                <!-- स्टेटस फिल्टर -->
                <div class="status-filter-container">
                    <button type="button" class="status-filter-btn active" data-filter="all">
                        All Products
                    </button>
                    <button type="button" class="status-filter-btn" data-filter="active">
                        Active
                    </button>
                    <button type="button" class="status-filter-btn" data-filter="inactive">
                        Inactive
                    </button>
                </div>
                
                <!-- नो रिजल्ट मैसेज -->
                <div class="no-results" id="noResults" style="display: none;">
                    <i class="fas fa-search"></i>
                    <h5>No Products Found</h5>
                    <p>Try searching with different keywords</p>
                </div>
                
                <!-- प्रोडक्ट कार्ड्स -->
                <div id="productCardsContainer">
                <?php 
                $card_i = 1;
                $qry = $conn->query("SELECT * FROM `product_list` WHERE delete_flag = 0 ORDER BY name ASC");
                while($row = $qry->fetch_assoc()):
                    $status_class = ($row['status'] == 1) ? 'active' : 'inactive';
                    $status_text = ($row['status'] == 1) ? 'Active' : 'Inactive';
                ?>
                    <div class="product-card <?php echo $status_class ?>" 
                         data-search="<?php echo htmlspecialchars(strtolower($row['name'] . ' ' . $row['description'] . ' ' . $row['id'] . ' ₹' . $row['price'])) ?>"
                         data-status="<?php echo $status_class ?>"
                         data-price="<?php echo $row['price'] ?>">
                        <img src="<?= validate_image($row['image_path']) ?>" alt="" loading="lazy">
                        
                        <h6 class="product-name mb-1"><?php echo $row['name'] ?></h6>
                        <p class="text-muted mb-2 small"><?php echo substr($row['description'], 0, 100) ?>...</p>
                        
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <strong class="text-primary">₹ <?php echo number_format($row['price'], 2) ?></strong>
                            <?php if($row['status'] == 1): ?>
                                <span class="badge badge-success"><?php echo $status_text ?></span>
                            <?php else: ?>
                                <span class="badge badge-danger"><?php echo $status_text ?></span>
                            <?php endif; ?>
                        </div>
                        
                        <div class="product-actions">
                            <small class="text-muted">#<?php echo $card_i++; ?></small>
                            <a class="btn btn-sm btn-info view_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>">
                                <i class="fas fa-eye"></i> View
                            </a>
                            <a class="btn btn-sm btn-warning edit_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>">
                                <i class="fas fa-edit"></i> Edit
                            </a>
                            <a class="btn btn-sm btn-danger delete_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>">
                                <i class="fas fa-trash"></i> Delete
                            </a>
                        </div>
                    </div>
                <?php endwhile; ?>
                </div>
            </div>
        </div>
    </div>
</div>
<script>
$(document).ready(function(){
    // Manual Export Functions
    function printTable() {
        var printWindow = window.open('', '_blank');
        var title = "Product List - <?php echo date('Y-m-d'); ?>";
        var tableData = $('#product-list-table').clone();
        
        // Action column remove करें
        tableData.find('th:nth-child(6), td:nth-child(6)').remove();
        
        var html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h2 { text-align: center; color: #333; }
                .print-info { text-align: right; font-size: 12px; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #f2f2f2; padding: 10px; text-align: left; border: 1px solid #ddd; font-weight: bold; }
                td { padding: 8px; border: 1px solid #ddd; }
                .text-center { text-align: center; }
                .product-name { font-weight: bold; }
                .badge { padding: 3px 8px; border-radius: 3px; font-size: 12px; }
                .badge-success { background-color: #28a745; color: white; }
                .badge-danger { background-color: #dc3545; color: white; }
                .prod-img { width: 40px; height: 40px; object-fit: cover; border-radius: 3px; }
                @media print {
                    @page { margin: 0.5cm; }
                    body { margin: 0; padding: 0; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }
            </style>
        </head>
        <body>
            <h2>Product List</h2>
            <div class="print-info">
                Generated on: <?php echo date('Y-m-d H:i:s'); ?><br>
                Total Products: <?php echo $conn->query("SELECT COUNT(*) as total FROM `product_list` WHERE delete_flag = 0")->fetch_assoc()['total']; ?>
            </div>
            ${tableData[0].outerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 500);
                };
            <\/script>
        </body>
        </html>`;
        
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    }

    function exportToExcel() {
        var table = $('#product-list-table').clone();
        
        table.find('th:nth-child(6), td:nth-child(6)').remove();
        table.find('img').remove();
        
        var html = table[0].outerHTML;
        
        var blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'products_<?php echo date("Y-m-d"); ?>.xls';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function exportToPDF() {
        printTable();
    }

    // Button event handlers
    $('#printBtn, #mobilePrintBtn').click(function() {
        printTable();
    });

    $('#pdfBtn, #mobilePdfBtn').click(function() {
        exportToPDF();
    });

    $('#excelBtn, #mobileExcelBtn').click(function() {
        exportToExcel();
    });

    // मोबाइल सर्च और फिल्टर फंक्शनलिटी
    var currentFilter = 'all';
    var currentSearch = '';
    
    function performMobileSearchAndFilter() {
        var searchTerm = $('#mobileSearchInput').val().toLowerCase().trim();
        var filterType = currentFilter;
        var resultsCount = 0;
        
        // Clear button show/hide
        if (searchTerm.length > 0) {
            $('#mobileSearchClear').show();
        } else {
            $('#mobileSearchClear').hide();
            $('#searchInfo').hide();
            $('#noResults').hide();
        }
        
        // Search and filter in all product cards
        $('.product-card').each(function() {
            var searchData = $(this).data('search');
            var status = $(this).data('status');
            var card = $(this);
            var showCard = true;
            
            // Apply search filter
            if (searchTerm.length > 0 && searchData.indexOf(searchTerm) === -1) {
                showCard = false;
            }
            
            // Apply status filter
            if (filterType !== 'all' && status !== filterType) {
                showCard = false;
            }
            
            if (showCard) {
                card.removeClass('hidden');
                resultsCount++;
            } else {
                card.addClass('hidden');
            }
        });
        
        // Show results info
        if (searchTerm.length > 0 || filterType !== 'all') {
            $('#resultCount').text(resultsCount);
            $('#searchInfo').show();
            
            if (resultsCount === 0) {
                $('#noResults').show();
            } else {
                $('#noResults').hide();
            }
        }
        
        currentSearch = searchTerm;
    }
    
    // Search input events
    $('#mobileSearchInput').on('input', function() {
        performMobileSearchAndFilter();
    });
    
    $('#mobileSearchBtn').click(function() {
        performMobileSearchAndFilter();
    });
    
    // Clear search
    $('#mobileSearchClear').click(function() {
        $('#mobileSearchInput').val('').focus();
        performMobileSearchAndFilter();
    });
    
    // Enter key for search
    $('#mobileSearchInput').keypress(function(e) {
        if (e.which == 13) {
            performMobileSearchAndFilter();
        }
    });
    
    // Status filter buttons
    $('.status-filter-btn').click(function() {
        $('.status-filter-btn').removeClass('active');
        $(this).addClass('active');
        currentFilter = $(this).data('filter');
        performMobileSearchAndFilter();
    });
    
    // Initialize
    performMobileSearchAndFilter();

    // Create New (Direct)
    $('#create_new').click(function(){
        uni_modal("<i class='fa fa-plus'></i> Add New Product","products/manage_product.php")
    });

    // Event Delegation
    $(document).on('click', '.view_data', function(){
        uni_modal("<i class='fa fa-bars'></i> Product Details","products/view_product.php?id="+$(this).attr('data-id'))
    });

    $(document).on('click', '.edit_data', function(){
        uni_modal("<i class='fa fa-edit'></i> Update Product Details","products/manage_product.php?id="+$(this).attr('data-id'))
    });

    $(document).on('click', '.delete_data', function(){
        _conf("Are you sure to delete this product permanently?","delete_product",[$(this).attr('data-id')])
    });
});

function delete_product($id){
    start_loader();
    $.ajax({
        url:_base_url_+"classes/Master.php?f=delete_product",
        method:"POST",
        data:{id: $id},
        dataType:"json",
        success:function(resp){
            if(resp.status == 'success') location.reload();
            else alert_toast("Error deleting product.",'error');
            end_loader();
        }
    })
}
</script>