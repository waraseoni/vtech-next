<?php if($_settings->chk_flashdata('success')): ?>
<script>alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')</script>
<?php endif;?>
<style>
    /* Export बटन्स के लिए */
    .export-buttons {
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
    
    /* टेबल स्टाइलिंग */
    #sales-table {
        width: 100%;
    }
    #sales-table th:nth-child(1), #sales-table td:nth-child(1) { width: 5%; }
    #sales-table th:nth-child(2), #sales-table td:nth-child(2) { width: 15%; }
    #sales-table th:nth-child(3), #sales-table td:nth-child(3) { width: 15%; }
    #sales-table th:nth-child(4), #sales-table td:nth-child(4) { width: 25%; }
    #sales-table th:nth-child(5), #sales-table td:nth-child(5) { width: 15%; text-align: right; }
    #sales-table th:nth-child(6), #sales-table td:nth-child(6) { width: 15%; }
    #sales-table th:nth-child(7), #sales-table td:nth-child(7) { width: 10%; }
    
    /* डेस्कटॉप के लिए DataTables कंट्रोल्स */
    .dataTables_wrapper .dataTables_length,
    .dataTables_wrapper .dataTables_filter,
    .dataTables_wrapper .dataTables_info,
    .dataTables_wrapper .dataTables_paginate {
        margin: 10px 0;
    }
    
    /* मोबाइल कार्ड व्यू */
    @media (max-width: 768px) {
        #sales-table { 
            display: none !important; 
        }
        
        .card-view { 
            display: block !important; 
        }
        
        /* डेस्कटॉप Export बटन्स हाइड करें */
        .card-tools .export-buttons {
            display: none !important;
        }
        
        /* डेस्कटॉप DataTables कंट्रोल्स हाइड करें */
        .dataTables_wrapper .dataTables_length,
        .dataTables_wrapper .dataTables_filter,
        .dataTables_wrapper .dataTables_info,
        .dataTables_wrapper .dataTables_paginate {
            display: none !important;
        }
        
        /* मोबाइल Export बटन्स */
        .mobile-export-buttons {
            display: flex !important;
            gap: 10px;
            margin-top: 15px;
            margin-bottom: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .mobile-export-btn {
            padding: 8px 15px;
            font-size: 13px;
            flex: 1;
            min-width: 90px;
            justify-content: center;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: all 0.3s;
        }
        .mobile-export-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 3px 5px rgba(0,0,0,0.2);
        }
        
        /* मोबाइल सर्च बार */
        .mobile-search-container {
            margin-bottom: 15px;
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
            right: 5px;
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
            right: 45px;
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
        
        /* स्टेटस फिल्टर बटन्स */
        .status-filter-container {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            gap: 5px;
            flex-wrap: wrap;
        }
        .status-filter-btn {
            flex: 1;
            min-width: 100px;
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
        .status-filter-btn.active:hover {
            background: #0069d9;
        }
        
        /* सैल कार्ड */
        .sale-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 15px;
            padding: 15px;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        .sale-card.hidden {
            display: none !important;
        }
        .sale-card:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }
        .sale-card .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }
        .sale-card .sale-code {
            font-weight: bold;
            color: #007bff;
            font-size: 1.1rem;
        }
        .sale-card .sale-date {
            color: #6c757d;
            font-size: 0.9rem;
        }
        .sale-card .client-info {
            margin-bottom: 10px;
        }
        .sale-card .client-name {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }
        .sale-card .amount-info {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .sale-card .amount-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #28a745;
            text-align: center;
        }
        .sale-card .payment-mode {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        .sale-card .payment-label {
            color: #6c757d;
        }
        .sale-card .payment-value {
            font-weight: 600;
            color: #333;
        }
        .sale-card .card-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 10px;
            border-top: 1px solid #eee;
        }
        .sale-card .sale-number {
            color: #6c757d;
            font-size: 0.9rem;
        }
        
        /* नो रिजल्ट मैसेज */
        .no-results {
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
            font-size: 1.1rem;
        }
        .no-results i {
            font-size: 3rem;
            color: #dee2e6;
            margin-bottom: 15px;
            display: block;
        }
    }
    
    @media (min-width: 769px) {
        .card-view { 
            display: none !important; 
        }
        .mobile-search-container { 
            display: none !important; 
        }
        .status-filter-container { 
            display: none !important; 
        }
        .sale-card { 
            display: none !important; 
        }
        .no-results {
            display: none !important;
        }
        .mobile-export-buttons {
            display: none !important;
        }
    }
    
    /* Print स्टाइल्स */
    @media print {
        .card-view, 
        .mobile-search-container,
        .status-filter-container,
        .sale-card,
        .no-results,
        .export-buttons,
        .mobile-export-buttons,
        .card-tools,
        .dataTables_length, 
        .dataTables_filter,
        .dataTables_info, 
        .dataTables_paginate,
        .dropdown-toggle,
        .dropdown-menu {
            display: none !important;
        }
        
        #sales-table {
            width: 100% !important;
            display: table !important;
            font-size: 11px !important;
        }
        
        th, td {
            padding: 5px !important;
        }
        
        .card {
            border: none !important;
            box-shadow: none !important;
        }
        
        @page {
            margin: 0.5cm;
        }
    }
</style>

<div class="card card-outline card-primary">
    <div class="card-header">
        <h3 class="card-title"><b>Direct Sales List</b></h3>
        <div class="card-tools d-flex align-items-center">
            <div class="export-buttons">
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
            <a href="./?page=direct_sales/manage_sale" class="btn btn-flat btn-primary"><span class="fas fa-plus"></span> New Sale</a>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            
            <!-- Print Header -->
            <div class="print-date" style="display: none;">
                Printed on: <?php echo date('Y-m-d H:i:s'); ?>
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
                        // Get summary data for reports
                        $summary_qry = $conn->query("SELECT 
                            COUNT(*) as total_sales,
                            SUM(total_amount) as total_amount,
                            AVG(total_amount) as avg_amount
                            FROM direct_sales");
                        $summary = $summary_qry->fetch_assoc();
                        
                        $sales = $conn->query("SELECT ds.*, CONCAT(c.firstname,' ',c.middlename,' ',c.lastname) as client_name 
                                               FROM direct_sales ds 
                                               LEFT JOIN client_list c ON ds.client_id = c.id 
                                               ORDER BY ds.date_created DESC");
                        while($row = $sales->fetch_assoc()):
                        ?>
                        <tr>
                            <td class="text-center"><?= $i++ ?></td>
                            <td><?= date("M d, Y", strtotime($row['date_created'])) ?></td>
                            <td><strong><?= $row['sale_code'] ?></strong></td>
                            <td><?= $row['client_name'] ?: '<span class="text-muted">Walk-in Customer</span>' ?></td>
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
                            <th class="text-right text-success">₹<?= number_format($summary['total_amount'] ?? 0, 2) ?></th>
                            <th colspan="2">Total Sales: <?= $summary['total_sales'] ?? 0 ?></th>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- मोबाइल कार्ड व्यू -->
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
                    <button type="button" class="status-filter-btn active" data-filter="all">
                        All Sales
                    </button>
                    <button type="button" class="status-filter-btn" data-filter="Cash">
                        Cash
                    </button>
                    <button type="button" class="status-filter-btn" data-filter="Card">
                        Card
                    </button>
                    <button type="button" class="status-filter-btn" data-filter="UPI">
                        UPI
                    </button>
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
                    $i = 1;
                    $sales = $conn->query("SELECT ds.*, CONCAT(c.firstname,' ',c.middlename,' ',c.lastname) as client_name 
                                           FROM direct_sales ds 
                                           LEFT JOIN client_list c ON ds.client_id = c.id 
                                           ORDER BY ds.date_created DESC");
                    while($row = $sales->fetch_assoc()):
                        $client_name = $row['client_name'] ?: 'Walk-in Customer';
                    ?>
                    <div class="sale-card" 
                         data-search="<?php echo htmlspecialchars(strtolower($row['sale_code'] . ' ' . $client_name . ' ' . number_format($row['total_amount'], 2))) ?>"
                         data-payment-mode="<?= $row['payment_mode'] ?>"
                         data-amount="<?= $row['total_amount'] ?>"
                         data-date="<?= strtotime($row['date_created']) ?>">
                        <div class="card-header">
                            <div class="sale-code"><?= $row['sale_code'] ?></div>
                            <div class="sale-date"><?= date("M d, Y", strtotime($row['date_created'])) ?></div>
                        </div>
                        
                        <div class="client-info">
                            <div class="client-name">
                                <i class="fas fa-user mr-1"></i> <?= $client_name ?>
                            </div>
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
    // DataTable Initialization - सिर्फ डेस्कटॉप के लिए
    var table = $('#sales-table').DataTable({
        "pageLength": 25,
        "order": [[1, "desc"]], // Date descending
        "responsive": true,
        "dom": '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rt<"row"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>',
        "columnDefs": [
            { "responsivePriority": 1, "targets": 4 }, // Amount
            { "responsivePriority": 2, "targets": 3 }, // Client
            { "responsivePriority": 3, "targets": 2 }, // Sale Code
            { "responsivePriority": 4, "targets": 1 }, // Date
            { "responsivePriority": 5, "targets": 6 }, // Action
            { "responsivePriority": 6, "targets": 5 }  // Payment Mode
        ]
    });

    // Manual Export Functions for Direct Sales
    function printSalesTable() {
        var printWindow = window.open('', '_blank');
        var title = "Direct Sales Report - <?php echo date('Y-m-d'); ?>";
        
        // Get summary data
        var totalSales = <?= $summary['total_sales'] ?? 0 ?>;
        var totalAmount = <?= $summary['total_amount'] ?? 0 ?>;
        var avgAmount = <?= $summary['avg_amount'] ?? 0 ?>;
        
        // Create table for print
        var tableData = $('#sales-table').clone();
        
        // Remove action column
        tableData.find('th:nth-child(7), td:nth-child(7)').remove();
        
        var html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h2 { text-align: center; color: #333; margin-bottom: 10px; }
                .report-summary { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 20px; 
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 5px;
                }
                .summary-item { text-align: center; flex: 1; }
                .summary-value { font-size: 1.5rem; font-weight: bold; display: block; }
                .summary-label { font-size: 0.9rem; color: #666; }
                .text-success { color: #28a745; }
                .print-info { text-align: right; font-size: 12px; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th { background-color: #007bff; color: white; padding: 10px; text-align: left; border: 1px solid #ddd; font-weight: bold; }
                td { padding: 8px; border: 1px solid #ddd; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .badge { padding: 3px 8px; border-radius: 3px; font-size: 11px; }
                .badge-success { background-color: #28a745; color: white; }
                .badge-primary { background-color: #007bff; color: white; }
                .badge-info { background-color: #17a2b8; color: white; }
                .badge-warning { background-color: #ffc107; color: white; }
                @media print {
                    @page { margin: 0.5cm; }
                    body { margin: 0; padding: 0; font-size: 11px; }
                    table { page-break-inside: auto; font-size: 11px; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    th, td { padding: 5px; }
                }
                .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
        </head>
        <body>
            <h2>Direct Sales Report</h2>
            <div class="print-info">
                Generated on: <?php echo date('Y-m-d H:i:s'); ?><br>
                Report Period: All Sales
            </div>
            
            <div class="report-summary">
                <div class="summary-item">
                    <span class="summary-value">${totalSales}</span>
                    <span class="summary-label">Total Sales</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value text-success">₹${parseFloat(totalAmount).toFixed(2)}</span>
                    <span class="summary-label">Total Amount</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value">₹${parseFloat(avgAmount).toFixed(2)}</span>
                    <span class="summary-label">Average Sale</span>
                </div>
            </div>
            
            ${tableData[0].outerHTML}
            
            <div class="footer">
                Direct Sales Management System | Page 1 of 1
            </div>
            
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

    function exportSalesToExcel() {
        // Clone the table
        var table = $('#sales-table').clone();
        
        // Remove Action column
        table.find('th:nth-child(7), td:nth-child(7)').remove();
        
        // Format the table for Excel
        var html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                table { border-collapse: collapse; width: 100%; }
                th { background-color: #007bff; color: white; padding: 10px; border: 1px solid #ddd; }
                td { padding: 8px; border: 1px solid #ddd; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .text-success { color: #28a745; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>Direct Sales Report - <?php echo date('Y-m-d'); ?></h2>
            <p>Generated on: <?php echo date('Y-m-d H:i:s'); ?></p>
            <p>Total Sales: <?= $summary['total_sales'] ?? 0 ?> | Total Amount: ₹<?= number_format($summary['total_amount'] ?? 0, 2) ?></p>
            ${table[0].outerHTML}
        </body>
        </html>`;
        
        // Create and download Excel file
        var blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'direct_sales_<?php echo date("Y-m-d_H-i-s"); ?>.xls';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function exportSalesToPDF() {
        printSalesTable();
    }

    // Export Button Event Handlers
    $('#printBtn, #mobilePrintBtn').click(function() {
        printSalesTable();
    });

    $('#pdfBtn, #mobilePdfBtn').click(function() {
        exportSalesToPDF();
    });

    $('#excelBtn, #mobileExcelBtn').click(function() {
        exportSalesToExcel();
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
        
        // Search and filter in all sales cards
        $('.sale-card').each(function() {
            var searchData = $(this).data('search');
            var paymentMode = $(this).data('payment-mode');
            var card = $(this);
            var showCard = true;
            
            // Apply search filter
            if (searchTerm.length > 0 && searchData.indexOf(searchTerm) === -1) {
                showCard = false;
            }
            
            // Apply payment mode filter
            if (filterType !== 'all' && paymentMode !== filterType) {
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
    
    // Payment mode filter buttons
    $('.status-filter-btn').click(function() {
        // Remove active class from all buttons
        $('.status-filter-btn').removeClass('active');
        // Add active class to clicked button
        $(this).addClass('active');
        // Update current filter
        currentFilter = $(this).data('filter');
        // Perform search and filter
        performMobileSearchAndFilter();
    });
    
    // Initialize
    performMobileSearchAndFilter();

    // Delete functionality for both table and cards
    $(document).on('click', '.delete_data', function(){
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
            if(resp.status=='success'){
                location.reload();
            }else{
                alert_toast("An error occured.",'error');
                end_loader();
            }
        }
    })
}
</script>