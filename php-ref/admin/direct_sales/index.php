<?php if($_settings->chk_flashdata('success')): ?>
<script>alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')</script>
<?php endif;?>

<?php
// ==============================================================
// FILTER HANDLING – default to current month
// ==============================================================
$from = isset($_GET['from']) && !empty($_GET['from']) ? $_GET['from'] : date('Y-m-01');
$to   = isset($_GET['to']) && !empty($_GET['to']) ? $_GET['to'] : date('Y-m-t');
$payment_filter = isset($_GET['payment_mode']) ? $_GET['payment_mode'] : '';

// Build WHERE clause for filtering
$where_sales = "WHERE 1=1";
if(!empty($from)){
    $where_sales .= " AND DATE(ds.date_created) >= '$from'";
}
if(!empty($to)){
    $where_sales .= " AND DATE(ds.date_created) <= '$to'";
}
if(!empty($payment_filter) && $payment_filter != 'all'){
    $where_sales .= " AND ds.payment_mode = '$payment_filter'";
}
?>

<style>
    /* Existing styles (keep everything) */
    .export-buttons { display: flex; gap: 8px; margin-left: 10px; }
    .export-btn { padding: 5px 12px; border-radius: 4px; font-size: 14px; display: flex; align-items: center; gap: 5px; transition: all 0.3s; }
    .export-btn:hover { transform: translateY(-2px); box-shadow: 0 3px 5px rgba(0,0,0,0.2); }
    .btn-print { background-color: #6c757d; color: white; border: 1px solid #6c757d; }
    .btn-pdf { background-color: #dc3545; color: white; border: 1px solid #dc3545; }
    .btn-excel { background-color: #28a745; color: white; border: 1px solid #28a745; }
    
    #sales-table { width: 100%; }
    #sales-table th:nth-child(1), #sales-table td:nth-child(1) { width: 5%; }
    #sales-table th:nth-child(2), #sales-table td:nth-child(2) { width: 15%; }
    #sales-table th:nth-child(3), #sales-table td:nth-child(3) { width: 15%; }
    #sales-table th:nth-child(4), #sales-table td:nth-child(4) { width: 25%; }
    #sales-table th:nth-child(5), #sales-table td:nth-child(5) { width: 15%; text-align: right; }
    #sales-table th:nth-child(6), #sales-table td:nth-child(6) { width: 15%; }
    #sales-table th:nth-child(7), #sales-table td:nth-child(7) { width: 10%; }
    
    .sale-code-link { color: #007bff; font-weight: bold; text-decoration: none; transition: all 0.2s; cursor: pointer; }
    .sale-code-link:hover { color: #0056b3; text-decoration: underline; }
    .sale-code-link:active { color: #004085; }
    .sale-card .sale-code { cursor: pointer; transition: all 0.2s; }
    .sale-card .sale-code:hover { color: #0056b3; }
    
    .dataTables_wrapper .dataTables_length,
    .dataTables_wrapper .dataTables_filter,
    .dataTables_wrapper .dataTables_info,
    .dataTables_wrapper .dataTables_paginate { margin: 10px 0; }
    
    .whatsapp-badge-mobile { display: inline-flex; align-items: center; padding: 4px 10px; background: #25D366; color: white; border-radius: 20px; font-size: 0.8rem; text-decoration: none; transition: all 0.3s; }
    .whatsapp-badge-mobile:hover { background: #1DA851; color: white; text-decoration: none; transform: translateY(-1px); }
    .client-avatar-mobile { flex-shrink: 0; }
    .client-photo-desktop { width: 50px; height: 50px; object-fit: cover; border-radius: 50%; border: 2px solid #dee2e6; padding: 2px; }
    .mobile-client-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    
    /* Filter Bar (same as ledger_report) */
    .filter-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-bottom: 20px;
        padding: 15px;
        background: #f1f3f5;
        border-radius: 8px;
        border: 1px solid #ced4da;
    }
    .filter-input {
        flex: 1 1 200px;
        padding: 8px 12px;
        border: 1px solid #adb5bd;
        border-radius: 4px;
        font-size: 0.9rem;
    }
    .filter-input:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
    }
    .filter-btn {
        padding: 8px 16px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background 0.2s;
    }
    .filter-btn:hover {
        background: #0056b3;
    }
    .filter-btn.reset {
        background: #6c757d;
    }
    .filter-btn.reset:hover {
        background: #545b62;
    }
    .filter-btn.nav-btn {
        background: #17a2b8;
    }
    .filter-btn.nav-btn:hover {
        background: #138496;
    }
    #filterResultCount {
        background: #e9ecef;
        border-radius: 20px;
        padding: 5px 15px;
        font-size: 0.85rem;
        color: #495057;
        border: 1px solid #dee2e6;
    }
    
    @media (max-width: 768px) {
        #sales-table { display: none !important; }
        .card-view { display: block !important; }
        .card-tools .export-buttons { display: none !important; }
        .dataTables_wrapper .dataTables_length,
        .dataTables_wrapper .dataTables_filter,
        .dataTables_wrapper .dataTables_info,
        .dataTables_wrapper .dataTables_paginate { display: none !important; }
        .mobile-export-buttons { display: flex !important; gap: 10px; margin-top: 15px; margin-bottom: 15px; justify-content: center; flex-wrap: wrap; }
        .mobile-export-btn { padding: 8px 15px; font-size: 13px; flex: 1; min-width: 90px; justify-content: center; border-radius: 4px; display: flex; align-items: center; gap: 5px; transition: all 0.3s; }
        .mobile-export-btn:hover { transform: translateY(-2px); box-shadow: 0 3px 5px rgba(0,0,0,0.2); }
        .mobile-search-container { margin-bottom: 15px; position: relative; }
        .mobile-search-input { width: 100%; padding: 12px 45px 12px 15px; border: 1px solid #ddd; border-radius: 25px; font-size: 0.95rem; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .mobile-search-input:focus { outline: none; border-color: #007bff; box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25); }
        .mobile-search-btn { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #6c757d; font-size: 1.2rem; padding: 5px 15px; }
        .mobile-search-clear { position: absolute; right: 45px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #dc3545; font-size: 1.2rem; padding: 5px; display: none; cursor: pointer; }
        .mobile-search-info { text-align: center; padding: 10px; font-size: 0.9rem; color: #6c757d; display: none; }
        .status-filter-container { display: flex; justify-content: space-between; margin-bottom: 15px; gap: 5px; flex-wrap: wrap; }
        .status-filter-btn { flex: 1; min-width: 100px; padding: 8px 5px; border: 1px solid #dee2e6; background: #fff; color: #495057; font-size: 0.85rem; border-radius: 5px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .status-filter-btn.active { background: #007bff; color: white; border-color: #007bff; }
        .status-filter-btn:hover { background: #f8f9fa; }
        .status-filter-btn.active:hover { background: #0069d9; }
        .sale-card { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; padding: 15px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.3s ease; }
        .sale-card.hidden { display: none !important; }
        .sale-card:hover { box-shadow: 0 4px 8px rgba(0,0,0,0.15); transform: translateY(-2px); }
        .sale-card .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
        .sale-card .sale-code { font-weight: bold; color: #007bff; font-size: 1.1rem; }
        .sale-card .sale-date { color: #6c757d; font-size: 0.9rem; }
        .sale-card .client-info { margin-bottom: 10px; }
        .client-name { font-weight: 600; color: #333; margin-bottom: 5px; }
        .sale-card .amount-info { background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .sale-card .amount-value { font-size: 1.5rem; font-weight: bold; color: #28a745; text-align: center; }
        .sale-card .payment-mode { display: flex; justify-content: space-between; margin-bottom: 15px; }
        .sale-card .payment-label { color: #6c757d; }
        .sale-card .payment-value { font-weight: 600; color: #333; }
        .sale-card .card-actions { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #eee; }
        .sale-card .sale-number { color: #6c757d; font-size: 0.9rem; }
        .no-results { text-align: center; padding: 40px 20px; color: #6c757d; font-size: 1.1rem; }
        .no-results i { font-size: 3rem; color: #dee2e6; margin-bottom: 15px; display: block; }
    }
    
    @media (min-width: 769px) {
        .card-view { display: none !important; }
        .mobile-search-container { display: none !important; }
        .status-filter-container { display: none !important; }
        .sale-card { display: none !important; }
        .no-results { display: none !important; }
        .mobile-export-buttons { display: none !important; }
    }
    
    @media print {
        .card-view, .mobile-search-container, .status-filter-container, .sale-card, .no-results,
        .export-buttons, .mobile-export-buttons, .card-tools, .dataTables_length, .dataTables_filter,
        .dataTables_info, .dataTables_paginate, .dropdown-toggle, .dropdown-menu, .whatsapp-badge-mobile,
        .badge.badge-success .fa-whatsapp, .filter-bar { display: none !important; }
        #sales-table { width: 100% !important; display: table !important; font-size: 11px !important; }
        th, td { padding: 5px !important; }
        .card { border: none !important; box-shadow: none !important; }
        @page { margin: 0.5cm; }
    }
</style>

<div class="card card-outline card-primary">
    <div class="card-header">
        <h3 class="card-title"><b>Direct Sales List</b></h3>
        <div class="card-tools d-flex align-items-center">
            <div class="export-buttons">
                <button type="button" class="export-btn btn-excel" id="excelBtn">
                    <i class="fas fa-file-excel"></i> Excel
                </button>
            </div>
            <a href="./?page=direct_sales/manage_sale" class="btn btn-flat btn-primary"><span class="fas fa-plus"></span> New Sale</a>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            
            <!-- FILTER BAR with month navigation -->
            <form action="" method="GET" id="filter-sales" class="mb-4 no-print">
                <input type="hidden" name="page" value="direct_sales/index">
                <div class="filter-bar">
                    <input type="date" name="from" class="filter-input" value="<?= htmlspecialchars($from) ?>" placeholder="From Date">
                    <input type="date" name="to" class="filter-input" value="<?= htmlspecialchars($to) ?>" placeholder="To Date">
                    <select name="payment_mode" class="filter-input">
                        <option value="all" <?= $payment_filter == 'all' || $payment_filter == '' ? 'selected' : '' ?>>All Payment Modes</option>
                        <option value="Cash" <?= $payment_filter == 'Cash' ? 'selected' : '' ?>>Cash</option>
                        <option value="Card" <?= $payment_filter == 'Card' ? 'selected' : '' ?>>Card</option>
                        <option value="UPI" <?= $payment_filter == 'UPI' ? 'selected' : '' ?>>UPI</option>
                        <option value="Bank Transfer" <?= $payment_filter == 'Bank Transfer' ? 'selected' : '' ?>>Bank Transfer</option>
                    </select>
                    <button class="filter-btn" type="submit"><i class="fas fa-filter"></i> Apply</button>
                    
                    <!-- Month navigation buttons -->
                    <button type="button" class="filter-btn nav-btn" id="prevMonthBtn"><i class="fa fa-chevron-left"></i> Previous Month</button>
                    <button type="button" class="filter-btn nav-btn" id="nextMonthBtn">Next Month <i class="fa fa-chevron-right"></i></button>
                    <button type="button" class="filter-btn reset" id="resetMonthBtn"><i class="fa fa-refresh"></i> Current Month</button>
                    
                    <?php
                    // Show result count if any filter is active
                    if(!empty($from) || !empty($to) || !empty($payment_filter) && $payment_filter != 'all'):
                    ?>
                    <span id="filterResultCount">Filtered results</span>
                    <?php endif; ?>
                </div>
            </form>

            <!-- Print Header -->
            <div class="print-date" style="display: none;">
                Printed on: <?php echo date('Y-m-d H:i:s'); ?>
            </div>
            
            <?php
            // ==============================================================
            // MAIN QUERY WITH FILTERS
            // ==============================================================
            $sales_sql = "SELECT ds.*, 
                          CONCAT(c.firstname,' ',COALESCE(c.middlename,''),' ',c.lastname) as client_name, 
                          CONCAT(m.firstname,' ',m.lastname) as staff_name,
                          c.id as client_id,
                          c.image_path as client_image,
                          c.contact as client_contact,
                          ds.last_edited_by,
                          ds.last_edited_date,
                          CASE 
                              WHEN ds.last_edited_by = 0 THEN 'Admin'
                              WHEN ds.last_edited_by IS NULL THEN NULL
                              ELSE CONCAT(ml.firstname,' ',ml.lastname)
                          END as last_editor_name
                          FROM direct_sales ds 
                          LEFT JOIN client_list c ON ds.client_id = c.id 
                          LEFT JOIN mechanic_list m ON ds.mechanic_id = m.id 
                          LEFT JOIN mechanic_list ml ON ds.last_edited_by = ml.id 
                          $where_sales
                          ORDER BY unix_timestamp(ds.date_created) DESC";
            
            $sales = $conn->query($sales_sql);
            if(!$sales){
                echo "Query Error: " . $conn->error;
            }

            // Compute summary based on filtered data
            $total_sales = $sales->num_rows;
            $total_amount = 0;
            $sales->data_seek(0); // reset pointer for later loop
            while($row = $sales->fetch_assoc()){
                $total_amount += $row['total_amount'];
            }
            $avg_amount = $total_sales > 0 ? $total_amount / $total_sales : 0;
            $sales->data_seek(0); // reset again for display loop
            ?>
            
            <!-- Summary cards -->
            <div class="row mb-3">
                <div class="col-md-4">
                    <div class="info-box bg-light border">
                        <div class="info-box-content">
                            <span class="info-box-text text-muted">Total Sales</span>
                            <span class="info-box-number text-primary" style="font-size: 1.3rem;"><?= $total_sales ?></span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="info-box bg-light border">
                        <div class="info-box-content">
                            <span class="info-box-text text-muted">Total Amount</span>
                            <span class="info-box-number text-success" style="font-size: 1.3rem;">₹ <?= number_format($total_amount, 2) ?></span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="info-box bg-light border">
                        <div class="info-box-content">
                            <span class="info-box-text text-muted">Average Sale</span>
                            <span class="info-box-number text-info" style="font-size: 1.3rem;">₹ <?= number_format($avg_amount, 2) ?></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- डेस्कटॉप/टैबलेट टेबल व्यू -->
            <div class="table-responsive">
                <table class="table table-hover table-striped table-bordered" id="sales-table">
                    <thead>
                        <tr class="bg-primary">
                            <th class="text-center">#</th>
                            <th>Date</th>
                            <th>Sale Code</th>
                            <th>Client</th>
                            <th class="text-right">Amount</th>
                            <th>Payment Mode</th>
                            <th class="text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $i = 1;
                        while($row = $sales->fetch_assoc()):
                            $last_edited_info = '';
                            if(!empty($row['last_editor_name'])) {
                                $last_edited_info = "Edited by: " . $row['last_editor_name'];
                                if(!empty($row['last_edited_date'])) {
                                    $last_edited_info .= " on " . date("d-m-Y h:i A", strtotime($row['last_edited_date']));
                                }
                            }
                            
                            $client_photo = validate_image($row['client_image'] ?? '');
                            $client_contact = $row['client_contact'] ?? '';
                        ?>
                        <tr>
                            <td class="text-center"><?= $i++ ?></td>
                            <td><?= date("M d, Y", strtotime($row['date_created'])) ?></td>
                            <td>
                                <a href="./?page=direct_sales/view_sale&id=<?= $row['id'] ?>" class="sale-code-link" title="Click to view sale details">
                                    <?= $row['sale_code'] ?>
                                </a>
                                <br>
                                <small>Sold by - <?= $row['staff_name'] ?: '<span class="text-muted">Admin</span>' ?></small>
                                <?php if(!empty($last_edited_info)): ?>
                                <br>
                                <small class="text-info">
                                    <i class="fas fa-user-edit"></i> <?= $last_edited_info ?>
                                </small>
                                <?php endif; ?>
                            </td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <?php if(!empty($row['client_id'])): ?>
                                        <div>
                                            <img src="<?= !empty($client_photo) ? $client_photo : (base_url . 'dist/img/no-image-available.png') ?>" 
                                                 class="client-photo-desktop" 
                                                 alt="Client Photo"
                                                 onerror="this.src='<?= base_url ?>dist/img/no-image-available.png'">
                                        </div>
                                        <div>
                                            <a href="./?page=clients/view_client&id=<?= $row['client_id'] ?>" class="text-primary" title="View Client Details">
                                                <i class="fas fa-external-link-alt mr-1"></i> <?= $row['client_name'] ?>
                                            </a>
                                            <?php if(!empty($client_contact)): 
                                                $wa_msg = "Namaste, aapka sale (".$row['sale_code'].") ka total amount ₹".number_format($row['total_amount'], 2)." hai.";
                                            ?>
                                            <div class="mt-1">
                                                <a href="https://wa.me/91<?= $client_contact ?>?text=<?= urlencode($wa_msg) ?>" 
                                                   target="_blank" 
                                                   class="badge badge-success" 
                                                   style="font-size: 0.75rem; padding: 3px 8px;">
                                                    <i class="fab fa-whatsapp mr-1"></i> <?= $client_contact ?>
                                                </a>
                                            </div>
                                            <?php endif; ?>
                                        </div>
                                    <?php else: ?>
                                        <div>
                                            <img src="<?= base_url ?>dist/img/no-image-available.png" 
                                                 class="client-photo-desktop" 
                                                 alt="Walk-in Customer">
                                        </div>
                                        <div>
                                            <span class="text-muted">Walk-in Customer</span>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </td>
                            <td class="text-right font-weight-bold text-success">₹<?= number_format($row['total_amount'], 2) ?></td>
                            <td>
                                <span class="badge badge-<?= 
                                    $row['payment_mode'] == 'Cash' ? 'success' : 
                                    ($row['payment_mode'] == 'Card' ? 'primary' : 
                                    ($row['payment_mode'] == 'UPI' ? 'info' : 'warning')) 
                                ?>">
                                    <?= $row['payment_mode'] ?>
                                </span>
                            </td>
                            <td align="center">
                                <div class="btn-group">
                                    <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">
                                        Action
                                    </button>
                                    <div class="dropdown-menu">
                                        <a class="dropdown-item" href="./?page=direct_sales/view_sale&id=<?= $row['id'] ?>">
                                            <i class="fas fa-eye text-info"></i> View
                                        </a>
										<div class="dropdown-divider"></div>
                                        <a class="dropdown-item" href="./?page=direct_sales/manage_sale&id=<?= $row['id'] ?>">
                                            <i class="fas fa-edit text-warning"></i> Edit
                                        </a>
                                        <div class="dropdown-divider"></div>
                                        <a class="dropdown-item delete_data" href="javascript:void(0)" data-id="<?= $row['id'] ?>">
                                            <i class="fas fa-trash text-danger"></i> Delete
                                        </a>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                    <tfoot>
                        <tr class="bg-light">
                            <th colspan="4" class="text-right">Total:</th>
                            <th class="text-right text-success">₹<?= number_format($total_amount, 2) ?></th>
                            <th colspan="2">Total Sales: <?= $total_sales ?></th>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- मोबाइल कार्ड व्यू (unchanged) -->
            <div class="card-view">
                <!-- मोबाइल Export बटन्स -->
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
                
                <!-- मोबाइल सर्च बार -->
                <div class="mobile-search-container">
                    <input type="text" class="mobile-search-input" id="mobileSearchInput" placeholder="Search by sale code, client or amount...">
                    <button type="button" class="mobile-search-clear" id="mobileSearchClear">
                        <i class="fas fa-times"></i>
                    </button>
                    <button type="button" class="mobile-search-btn" id="mobileSearchBtn">
                        <i class="fas fa-search"></i>
                    </button>
                    <div class="mobile-search-info" id="searchInfo">
                        Found <span id="resultCount">0</span> sales
                    </div>
                </div>
                
                <!-- पेमेंट मोड फिल्टर बटन्स -->
                <div class="status-filter-container">
                    <button type="button" class="status-filter-btn active" data-filter="all">All Sales</button>
                    <button type="button" class="status-filter-btn" data-filter="Cash">Cash</button>
                    <button type="button" class="status-filter-btn" data-filter="Card">Card</button>
                    <button type="button" class="status-filter-btn" data-filter="UPI">UPI</button>
                </div>
                
                <!-- नो रिजल्ट मैसेज -->
                <div class="no-results" id="noResults" style="display: none;">
                    <i class="fas fa-search"></i>
                    <h5>No Sales Found</h5>
                    <p>Try searching with different keywords</p>
                </div>
                
                <!-- सैल कार्ड्स -->
                <div id="salesCardsContainer">
                    <?php 
                    // Reset pointer for mobile cards loop
                    $sales->data_seek(0);
                    $i = 1;
                    while($row = $sales->fetch_assoc()):
                        $client_name = $row['client_name'] ?: 'Walk-in Customer';
                        $client_id = $row['client_id'];
                        $client_photo = validate_image($row['client_image'] ?? '');
                        $client_contact = $row['client_contact'] ?? '';
                        
                        $last_edited_mobile = '';
                        if(!empty($row['last_editor_name'])) {
                            $last_edited_mobile = $row['last_editor_name'];
                            if(!empty($row['last_edited_date'])) {
                                $last_edited_mobile .= " on " . date("d-m-Y", strtotime($row['last_edited_date']));
                            }
                        }
                    ?>
                    <div class="sale-card" 
                         data-search="<?php echo htmlspecialchars(strtolower($row['sale_code'] . ' ' . $client_name . ' ' . number_format($row['total_amount'], 2))) ?>"
                         data-payment-mode="<?= $row['payment_mode'] ?>"
                         data-amount="<?= $row['total_amount'] ?>"
                         data-date="<?= strtotime($row['date_created']) ?>"
                         data-id="<?= $row['id'] ?>">
                        <div class="card-header">
                            <div class="sale-code" onclick="window.location.href='./?page=direct_sales/view_sale&id=<?= $row['id'] ?>'" title="Click to view sale details">
                                <?= $row['sale_code'] ?>
                            </div>
                            <div class="sale-date"><?= date("M d, Y", strtotime($row['date_created'])) ?></div>
                        </div>
                        
                        <div class="client-info">
                            <div class="mobile-client-header">
                                <?php if(!empty($client_id)): ?>
                                    <div class="client-avatar-mobile">
                                        <img src="<?= !empty($client_photo) ? $client_photo : (base_url . 'dist/img/no-image-available.png') ?>" 
                                             class="rounded-circle" 
                                             style="width: 60px; height: 60px; object-fit: cover; border: 2px solid #007bff;"
                                             alt="Client Photo"
                                             onerror="this.src='<?= base_url ?>dist/img/no-image-available.png'">
                                    </div>
                                <?php else: ?>
                                    <div class="client-avatar-mobile">
                                        <img src="<?= base_url ?>dist/img/no-image-available.png" 
                                             class="rounded-circle" 
                                             style="width: 60px; height: 60px; object-fit: cover; border: 2px solid #6c757d;"
                                             alt="Walk-in Customer">
                                    </div>
                                <?php endif; ?>
                                
                                <div style="flex: 1;">
                                    <div class="client-name">
                                        <i class="fas fa-user mr-1"></i> 
                                        <?php if(!empty($client_id)): ?>
                                            <a href="./?page=clients/view_client&id=<?= $client_id ?>" class="text-primary" title="View Client Details">
                                                <?= $client_name ?> <i class="fas fa-external-link-alt ml-1"></i>
                                            </a>
                                        <?php else: ?>
                                            <?= $client_name ?>
                                        <?php endif; ?>
                                    </div>
                                    
                                    <?php if(!empty($client_contact)): 
                                        $wa_msg = "Namaste, aapka sale (".$row['sale_code'].") ka total amount ₹".number_format($row['total_amount'], 2)." hai.";
                                    ?>
                                    <div class="mt-1">
                                        <a href="https://wa.me/91<?= $client_contact ?>?text=<?= urlencode($wa_msg) ?>" 
                                           target="_blank" 
                                           class="whatsapp-badge-mobile">
                                            <i class="fab fa-whatsapp mr-1"></i> <?= $client_contact ?>
                                        </a>
                                    </div>
                                    <?php endif; ?>
                                </div>
                            </div>
                            
                            <div class="sold-by-info mb-2">
                                <small class="text-muted">
                                    <i class="fas fa-user-tag mr-1"></i>
                                    Sold by: <?= $row['staff_name'] ?: 'Admin' ?>
                                </small>
                            </div>
                            
                            <?php if(!empty($last_edited_mobile)): ?>
                            <div class="last-edited-info mb-2">
                                <small class="text-info">
                                    <i class="fas fa-user-edit mr-1"></i>
                                    Edited: <?= $last_edited_mobile ?>
                                </small>
                            </div>
                            <?php endif; ?>
                        </div>
                        
                        <div class="amount-info">
                            <div class="amount-value">₹<?= number_format($row['total_amount'], 2) ?></div>
                        </div>
                        
                        <div class="payment-mode">
                            <span class="payment-label">Payment Mode:</span>
                            <span class="payment-value">
                                <span class="badge badge-<?= 
                                    $row['payment_mode'] == 'Cash' ? 'success' : 
                                    ($row['payment_mode'] == 'Card' ? 'primary' : 
                                    ($row['payment_mode'] == 'UPI' ? 'info' : 'warning')) 
                                ?>">
                                    <?= $row['payment_mode'] ?>
                                </span>
                            </span>
                        </div>
                        
                        <div class="card-actions">
                            <div class="sale-number">#<?= $i++ ?></div>
                            <div class="action-buttons">
                                <a href="./?page=direct_sales/view_sale&id=<?= $row['id'] ?>" class="btn btn-sm btn-info mr-2">
                                    <i class="fas fa-eye"></i> View
                                </a>
                                <a href="./?page=direct_sales/manage_sale&id=<?= $row['id'] ?>" class="btn btn-sm btn-warning mr-2">
                                    <i class="fas fa-edit"></i> Edit
                                </a>
                                <button type="button" class="btn btn-sm btn-danger delete_data" data-id="<?= $row['id'] ?>">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
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
    // DataTable Initialization
    var table = $('#sales-table').DataTable({
        "pageLength": 25,
        "order": [[1, "desc"]],
        "responsive": true,
        "dom": '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rt<"row"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>',
        "columnDefs": [
            { "responsivePriority": 1, "targets": 4 },
            { "responsivePriority": 2, "targets": 3 },
            { "responsivePriority": 3, "targets": 2 },
            { "responsivePriority": 4, "targets": 1 },
            { "responsivePriority": 5, "targets": 6 },
            { "responsivePriority": 6, "targets": 5 }
        ]
    });

    // Date helper functions
    function formatDate(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }
    
    function getFirstDayOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }
    
    function getLastDayOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    // Month navigation
    $('#prevMonthBtn').click(function() {
        var fromDate = new Date($('input[name="from"]').val() + 'T00:00:00');
        var baseDate = isNaN(fromDate.getTime()) ? new Date() : fromDate;
        var prevMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
        var firstDay = getFirstDayOfMonth(prevMonth);
        var lastDay = getLastDayOfMonth(prevMonth);
        $('input[name="from"]').val(formatDate(firstDay));
        $('input[name="to"]').val(formatDate(lastDay));
        $('#filter-sales').submit();
    });

    $('#nextMonthBtn').click(function() {
        var fromDate = new Date($('input[name="from"]').val() + 'T00:00:00');
        var baseDate = isNaN(fromDate.getTime()) ? new Date() : fromDate;
        var nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
        var firstDay = getFirstDayOfMonth(nextMonth);
        var lastDay = getLastDayOfMonth(nextMonth);
        $('input[name="from"]').val(formatDate(firstDay));
        $('input[name="to"]').val(formatDate(lastDay));
        $('#filter-sales').submit();
    });

    $('#resetMonthBtn').click(function() {
        var today = new Date();
        var firstDay = getFirstDayOfMonth(today);
        var lastDay = getLastDayOfMonth(today);
        $('input[name="from"]').val(formatDate(firstDay));
        $('input[name="to"]').val(formatDate(lastDay));
        $('select[name="payment_mode"]').val('all');
        $('#filter-sales').submit();
    });

    // Mobile card click handlers
    $(document).on('click', '.sale-card .sale-code', function(e) {
        if ($(e.target).is('a')) return;
        var card = $(this).closest('.sale-card');
        var saleId = card.data('id');
        if (saleId) window.location.href = './?page=direct_sales/view_sale&id=' + saleId;
    });

    $(document).on('click', '.sale-card', function(e) {
        if ($(e.target).closest('.action-buttons, a, button, .delete_data').length === 0) {
            var saleId = $(this).data('id');
            if (saleId) window.location.href = './?page=direct_sales/view_sale&id=' + saleId;
        }
    });

    // Export functions
    function printSalesTable() {
        var printWindow = window.open('', '_blank');
        var title = "Direct Sales Report - " + new Date().toISOString().slice(0,10);
        var totalSales = <?= $total_sales ?>;
        var totalAmount = <?= $total_amount ?>;
        var avgAmount = <?= $avg_amount ?>;
        var generatedDate = "<?php echo date('Y-m-d H:i:s'); ?>";
        
        var tableData = $('#sales-table').clone();
        tableData.find('th:nth-child(7), td:nth-child(7)').remove();
        
        var html = '<!DOCTYPE html><html><head><title>' + title + '</title><style>' +
                   'body { font-family: Arial, sans-serif; margin: 20px; }' +
                   'h2 { text-align: center; color: #333; margin-bottom: 10px; }' +
                   '.report-summary { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; }' +
                   '.summary-item { text-align: center; flex: 1; }' +
                   '.summary-value { font-size: 1.5rem; font-weight: bold; display: block; }' +
                   '.summary-label { font-size: 0.9rem; color: #666; }' +
                   '.text-success { color: #28a745; }' +
                   '.print-info { text-align: right; font-size: 12px; color: #666; margin-bottom: 20px; }' +
                   'table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }' +
                   'th { background-color: #007bff; color: white; padding: 10px; text-align: left; border: 1px solid #ddd; font-weight: bold; }' +
                   'td { padding: 8px; border: 1px solid #ddd; }' +
                   '.text-center { text-align: center; }' +
                   '.text-right { text-align: right; }' +
                   '.badge { padding: 3px 8px; border-radius: 3px; font-size: 11px; }' +
                   '.badge-success { background-color: #28a745; color: white; }' +
                   '.badge-primary { background-color: #007bff; color: white; }' +
                   '.badge-info { background-color: #17a2b8; color: white; }' +
                   '.badge-warning { background-color: #ffc107; color: white; }' +
                   '@media print { @page { margin: 0.5cm; } body { margin: 0; padding: 0; font-size: 11px; } table { page-break-inside: auto; font-size: 11px; } tr { page-break-inside: avoid; } th, td { padding: 5px; } }' +
                   '.footer { text-align: center; margin-top: 30px; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }' +
                   '</style></head><body>' +
                   '<h2>Direct Sales Report</h2>' +
                   '<div class="print-info">Generated on: ' + generatedDate + '<br>Report Period: <?= !empty($from) ? "From $from" : "All" ?> <?= !empty($to) ? "To $to" : "" ?></div>' +
                   '<div class="report-summary">' +
                   '<div class="summary-item"><span class="summary-value">' + totalSales + '</span><span class="summary-label">Total Sales</span></div>' +
                   '<div class="summary-item"><span class="summary-value text-success">₹' + parseFloat(totalAmount).toFixed(2) + '</span><span class="summary-label">Total Amount</span></div>' +
                   '<div class="summary-item"><span class="summary-value">₹' + parseFloat(avgAmount).toFixed(2) + '</span><span class="summary-label">Average Sale</span></div>' +
                   '</div>' +
                   tableData[0].outerHTML +
                   '<div class="footer">Direct Sales Management System | Page 1 of 1</div>' +
                   '<script>window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 500); }</scr' + 'ipt>' +   // FIXED
                   '</body></html>';
        
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    }

    function exportSalesToExcel() {
        var table = $('#sales-table').clone();
        table.find('th:nth-child(7), td:nth-child(7)').remove();
        var generatedDate = "<?php echo date('Y-m-d H:i:s'); ?>";
        var totalSales = <?= $total_sales ?>;
        var totalAmount = "<?= number_format($total_amount, 2) ?>";
        var reportDate = "<?php echo date('Y-m-d'); ?>";
        var fileNameDate = "<?php echo date('Y-m-d_H-i-s'); ?>";
        
        var html = '<html><head><meta charset="UTF-8"><style>' +
                   'table { border-collapse: collapse; width: 100%; }' +
                   'th { background-color: #007bff; color: white; padding: 10px; border: 1px solid #ddd; }' +
                   'td { padding: 8px; border: 1px solid #ddd; }' +
                   '.text-center { text-align: center; }' +
                   '.text-right { text-align: right; }' +
                   '.text-success { color: #28a745; font-weight: bold; }' +
                   '</style></head><body>' +
                   '<h2>Direct Sales Report - ' + reportDate + '</h2>' +
                   '<p>Generated on: ' + generatedDate + '</p>' +
                   '<p>Total Sales: ' + totalSales + ' | Total Amount: ₹' + totalAmount + '</p>' +
                   table[0].outerHTML +
                   '</body></html>';
        
        var blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'direct_sales_' + fileNameDate + '.xls';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function exportSalesToPDF() {
        printSalesTable();
    }

    $('#printBtn, #mobilePrintBtn').click(printSalesTable);
    $('#pdfBtn, #mobilePdfBtn').click(exportSalesToPDF);
    $('#excelBtn, #mobileExcelBtn').click(exportSalesToExcel);

    // Mobile search and filter
    var currentFilter = 'all';
    var currentSearch = '';
    
    function performMobileSearchAndFilter() {
        var searchTerm = $('#mobileSearchInput').val().toLowerCase().trim();
        var filterType = currentFilter;
        var resultsCount = 0;
        
        if (searchTerm.length > 0) $('#mobileSearchClear').show();
        else {
            $('#mobileSearchClear').hide();
            $('#searchInfo').hide();
            $('#noResults').hide();
        }
        
        $('.sale-card').each(function() {
            var searchData = $(this).data('search');
            var paymentMode = $(this).data('payment-mode');
            var card = $(this);
            var showCard = true;
            
            if (searchTerm.length > 0 && searchData.indexOf(searchTerm) === -1) showCard = false;
            if (filterType !== 'all' && paymentMode !== filterType) showCard = false;
            
            if (showCard) {
                card.removeClass('hidden');
                resultsCount++;
            } else {
                card.addClass('hidden');
            }
        });
        
        if (searchTerm.length > 0 || filterType !== 'all') {
            $('#resultCount').text(resultsCount);
            $('#searchInfo').show();
            $('#noResults').toggle(resultsCount === 0);
        }
        currentSearch = searchTerm;
    }
    
    $('#mobileSearchInput').on('input', performMobileSearchAndFilter);
    $('#mobileSearchBtn').click(performMobileSearchAndFilter);
    $('#mobileSearchClear').click(function() {
        $('#mobileSearchInput').val('').focus();
        performMobileSearchAndFilter();
    });
    $('#mobileSearchInput').keypress(function(e) {
        if (e.which == 13) performMobileSearchAndFilter();
    });
    
    $('.status-filter-btn').click(function() {
        $('.status-filter-btn').removeClass('active');
        $(this).addClass('active');
        currentFilter = $(this).data('filter');
        performMobileSearchAndFilter();
    });
    
    performMobileSearchAndFilter();

    // Delete functionality
    $(document).on('click', '.delete_data', function(e){
        e.stopPropagation();
        _conf("Are you sure to delete this direct sale permanently?","delete_sale",[$(this).attr('data-id')]);
    });
});

function delete_sale($id){
    start_loader();
    $.ajax({
        url:_base_url_+"classes/Master.php?f=delete_direct_sale",
        method:"POST",
        data:{id: $id},
        dataType:"json",
        success:function(resp){
            if(resp.status=='success') location.reload();
            else { alert_toast("An error occured.",'error'); end_loader(); }
        }
    });
}
</script>