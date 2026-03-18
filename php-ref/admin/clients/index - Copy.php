<?php if($_settings->chk_flashdata('success')): ?>
<script>
    alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')
</script>
<?php endif;?>

<style>
    /* --- COMMON STYLES --- */
    .address-text { font-size: 0.95rem; color: #444; line-height: 1.3; }
    
    /* बैलेंस कलर्स */
    .high-balance { background-color: #fff5f5 !important; }
    .very-high-balance { background-color: #ffe6e6 !important; border-left: 4px solid #ff0000 !important; }
    .balance-positive { color: #dc3545 !important; font-weight: bold; }
    .balance-high { color: #ff5722 !important; font-weight: bold; }
    .balance-very-high { color: #ff0000 !important; font-weight: bold; }
    .balance-negative { color: #28a745 !important; font-weight: bold; }

    /* Export बटन्स */
    .export-buttons { display: flex; gap: 8px; margin-left: 10px; }
    .export-btn { padding: 6px 15px; border-radius: 4px; font-size: 14px; display: flex; align-items: center; gap: 5px; transition: all 0.3s; text-decoration: none !important; cursor: pointer; border: none; }
    .export-btn:hover { opacity: 0.9; }
    .btn-print { background-color: #6c757d; color: white; }
    .btn-pdf { background-color: #dc3545; color: white; }
    .btn-excel { background-color: #28a745; color: white; }
    
    /* WhatsApp बटन */
    .whatsapp-badge { display: inline-flex; align-items: center; padding: 5px 10px; background: #25D366; color: white; border-radius: 20px; font-size: 0.85rem; margin-top: 5px; text-decoration: none; }
    .whatsapp-badge:hover { background: #1DA851; color: white; }
    
    /* --- DESKTOP TABLE SPECIFIC STYLES --- */
    .desktop-avatar {
        width: 60px;
        height: 85px;
        object-fit: cover; /* Photo ko chokor frame mein fit rakhega */
        border: 2px solid #dee2e6;
        border-radius: 4px; /* Bilkul sharp chokor ke liye ise 0 kar dein, halka curve ke liye 4px rehne dein */
    }
    .client-info-cell {
        display: flex !important;
        align-items: center;
        gap: 15px; /* फोटो और नाम के बीच गैप */
    }
    .client-info-text h5 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
        color: #333;
    }
    
    /* --- MOBILE CARD VIEW STYLES --- */
    .mobile-export-buttons { display: none; }
    
    @media (max-width: 768px) {
        /* डेस्कटॉप टेबल छुपाएं */
        .table-responsive { display: none !important; }
        /* मोबाइल कार्ड दिखाएं */
        .card-view { display: block !important; }
        
        .mobile-export-buttons { display: flex !important; justify-content: center; gap: 10px; margin-bottom: 15px; padding: 0 10px; }
        .desktop-export-buttons { display: none !important; }
        
        /* कार्ड डिज़ाइन */
        .client-card { border: 1px solid #ddd; border-radius: 8px; margin: 0 10px 15px 10px; padding: 15px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative; }
        .client-card.high-balance { border-left: 4px solid #dc3545; background-color: #fff5f5; }
        .client-card.very-high-balance { border-left: 4px solid #ff0000; background-color: #ffe6e6; }
        .client-card.hidden { display: none !important; }
        
        .client-header { display: flex; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
        
        .client-avatar {
            width: 65px; height: 65px; border-radius: 50%; overflow: hidden; 
            border: 2px solid #007bff; margin-right: 15px; flex-shrink: 0;
            background: #f4f4f4; display: flex; align-items: center; justify-content: center;
        }
        .client-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .client-name { font-weight: bold; font-size: 1.1rem; color: #333; margin-bottom: 5px; }
        .client-id { font-size: 0.85rem; color: #6c757d; }
        
        .contact-info { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        .contact-item { display: flex; align-items: center; margin-bottom: 8px; font-size: 0.9rem; }
        .contact-item i { width: 20px; color: #495057; margin-right: 10px; }
        
        .address-box { margin: 10px 0; padding: 10px; background: #f0f8ff; border-radius: 5px; font-size: 0.9rem; line-height: 1.4; }
        
        .balance-info { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; padding: 10px; background: #fff; border: 1px solid #e9ecef; border-radius: 5px; }
        .balance-amount { font-size: 1.3rem; font-weight: bold; }
        
        .card-actions { text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
        .btn-action-group { display: flex; gap: 10px; justify-content: center; }
        
        /* सर्च बार */
        .mobile-search-container { margin-bottom: 15px; position: relative; }
        .mobile-search-input { width: 100%; padding: 12px 45px 12px 15px; border: 1px solid #ddd; border-radius: 25px; font-size: 0.95rem; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .mobile-search-clear { position: absolute; right: 45px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #dc3545; font-size: 1.2rem; padding: 5px; display: none; cursor: pointer; }
        .mobile-search-btn { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #6c757d; font-size: 1.2rem; padding: 5px 15px; }
        #searchResultCount { background: #e9ecef; border-radius: 20px; padding: 5px 15px !important; display: inline-block; margin: 10px 10px 15px 15px; font-size: 0.85rem; color: #495057; border: 1px solid #dee2e6; transition: all 0.3s ease; }
        #countValue { color: #007bff; font-weight: 800; }
        .no-results { text-align: center; padding: 40px 20px; color: #6c757d; font-size: 1.1rem; margin: 0 10px; }
    }
    
    @media (min-width: 769px) {
        .card-view, .mobile-export-buttons { display: none !important; }
        .table-responsive { display: block !important; }
        .desktop-export-buttons { display: flex !important; }
    }
</style>

<div class="card card-outline card-primary shadow-sm">
    <div class="card-header">
        <h3 class="card-title"><b><i class="fa fa-users text-primary"></i> Client Management</b></h3>
        <div class="card-tools d-flex align-items-center">
            <div class="desktop-export-buttons">
                <button type="button" class="export-btn btn-print" id="printBtn" onclick="printReport()"><i class="fas fa-print"></i> Print</button>
                <button type="button" class="export-btn btn-pdf" id="pdfBtn" onclick="exportPDF()"><i class="fas fa-file-pdf"></i> PDF</button>
                <button type="button" class="export-btn btn-excel" id="excelBtn" onclick="exportExcel()"><i class="fas fa-file-excel"></i> Excel</button>
            </div>
            <a href="javascript:void(0)" id="create_new" class="btn btn-flat btn-sm btn-primary ml-2"><span class="fas fa-plus"></span> Add New Client</a>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            <div class="mobile-export-buttons">
                <button type="button" class="export-btn btn-print" id="mobilePrintBtn" onclick="printReport()"><i class="fas fa-print"></i> Print</button>
                <button type="button" class="export-btn btn-pdf" id="mobilePdfBtn" onclick="exportPDF()"><i class="fas fa-file-pdf"></i> PDF</button>
                <button type="button" class="export-btn btn-excel" id="mobileExcelBtn" onclick="exportExcel()"><i class="fas fa-file-excel"></i> Excel</button>
            </div>
            
            <div class="table-responsive">
                <table class="table table-hover table-striped table-bordered" id="client-list-main">
                    <thead class="bg-navy">
                        <tr>
                            <th class="text-center" width="5%">#</th>
                            <th width="25%">Client Details</th> 
                            <th width="25%">Contact Info</th>
                            <th>Address</th>
                            <th class="text-right">Balance</th>
                            <th class="text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $i = 1;
                        // UPDATED QUERY - Now matches view_client.php calculation
                        $qry = $conn->query("SELECT c.*, 
                            COALESCE((SELECT SUM(amount) FROM transaction_list WHERE client_name = c.id AND status = 5), 0) as repair_billed,
                            COALESCE((SELECT SUM(total_amount) FROM direct_sales WHERE client_id = c.id), 0) as direct_sales_billed,
                            COALESCE((SELECT SUM(amount + discount) FROM client_payments WHERE client_id = c.id), 0) as total_paid
                            FROM `client_list` c WHERE c.delete_flag = 0 
                            ORDER BY (c.opening_balance + 
                                COALESCE((SELECT SUM(amount) FROM transaction_list WHERE client_name = c.id AND status = 5), 0) + 
                                COALESCE((SELECT SUM(total_amount) FROM direct_sales WHERE client_id = c.id), 0) - 
                                COALESCE((SELECT SUM(amount + discount) FROM client_payments WHERE client_id = c.id), 0)) DESC");
                        
                        $grand_receivable = 0;
                        while($row = $qry->fetch_assoc()):
                            // UPDATED CALCULATION - Now matches view_client.php
                            $total_billed = $row['repair_billed'] + $row['direct_sales_billed'];
                            $current_balance = ($row['opening_balance'] + $total_billed) - $row['total_paid'];
                            $grand_receivable += $current_balance;
                            $fullname = ucwords($row['firstname'] . ' ' . $row['middlename'] . ' ' . $row['lastname']);
                            
                            $row_class = '';
                            $balance_class = '';
                            if($current_balance > 0) {
                                if($current_balance > 50000) { $row_class = 'very-high-balance'; $balance_class = 'balance-very-high'; } 
                                elseif($current_balance > 20000) { $row_class = 'high-balance'; $balance_class = 'balance-high'; } 
                                else { $balance_class = 'balance-positive'; }
                            } else { $balance_class = 'balance-negative'; }
                        ?>
                        <tr class="<?php echo $row_class ?>" data-balance="<?php echo $current_balance ?>">
                            <td class="text-center align-middle"><?php echo $i++; ?></td>
                            
                            <td>
                                <div class="client-info-cell">
                                    <img src="<?php echo validate_image($row['image_path']) ?>" 
     class="desktop-avatar view_image_full" 
     alt="Client"
     style="cursor:pointer"
     data-src="<?php echo validate_image($row['image_path']) ?>"
     onerror="this.src='<?php echo base_url ?>dist/img/no-image-available.png'">
                                    
                                    <div class="client-info-text">
    <a href="./?page=clients/view_client&id=<?php echo $row['id'] ?>" class="text-decoration-none">
        <h5 class="text-primary"><?php echo $fullname ?></h5>
    </a>
    <small class="text-muted">ID: <?php echo $row['id'] ?></small>
</div>
                                </div>
                            </td>

                            <td class="align-middle">
                                <div class="lh-1">
                                    <div><i class="fa fa-phone-alt fa-fw text-primary"></i> <?php echo $row['contact'] ?></div>
                                    <div class="mt-1"><i class="fa fa-envelope fa-fw text-danger"></i> <?php echo $row['email'] ?: 'No Email' ?></div>
                                    <?php if(!empty($row['contact'])): 
                                        $wa_msg = "Namaste ". $fullname .", aapka pending balance ₹". number_format($current_balance, 2) ." hai. Kripya bhugtan karein.";
                                    ?>
                                    <a href="https://wa.me/91<?php echo $row['contact'] ?>?text=<?php echo urlencode($wa_msg) ?>" target="_blank" class="whatsapp-badge mt-1"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                                    <?php endif; ?>
                                </div>
                            </td>
                            <td class="address-text align-middle"><?php echo $row['address'] ?></td>
                            <td class="text-right align-middle font-weight-bold <?php echo $balance_class ?>">₹ <?php echo number_format($current_balance, 2) ?></td>
                            <td align="center" class="align-middle">
                                <div class="btn-group">
                                    <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">Action</button>
                                    <div class="dropdown-menu" role="menu">
                                        <a class="dropdown-item" href="./?page=clients/view_client&id=<?php echo $row['id'] ?>"><span class="fa fa-eye text-primary"></span> View</a>
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
                    <tfoot>
                        <tr class="bg-light">
                            <th colspan="4" class="text-right">Total Outstanding:</th>
                            <th class="text-right text-danger">₹ <?php echo number_format($grand_receivable, 2) ?></th>
                            <th></th>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="card-view">
                <div class="mobile-search-container">
                    <input type="text" class="mobile-search-input" id="mobileSearchInput" placeholder="Search clients...">
                    <button type="button" class="mobile-search-clear" id="mobileSearchClear"><i class="fas fa-times"></i></button>
                    <button type="button" class="mobile-search-btn" id="mobileSearchBtn"><i class="fas fa-search"></i></button>
                </div>
                
                <div class="no-results" id="noResults" style="display: none;">
                    <i class="fas fa-search"></i><h5>No Clients Found</h5>
                </div>
                <div id="searchResultCount" class="px-3 mb-2 text-muted" style="display:none; font-size: 0.9rem;">
                        Found <span id="countValue" class="font-weight-bold text-primary">0</span> results
                </div>
                
                <div id="clientCardsContainer">
                <?php 
                // UPDATED QUERY FOR MOBILE - Same as above
                $qry = $conn->query("SELECT c.*, 
                    COALESCE((SELECT SUM(amount) FROM transaction_list WHERE client_name = c.id AND status = 5), 0) as repair_billed,
                    COALESCE((SELECT SUM(total_amount) FROM direct_sales WHERE client_id = c.id), 0) as direct_sales_billed,
                    COALESCE((SELECT SUM(amount + discount) FROM client_payments WHERE client_id = c.id), 0) as total_paid
                    FROM `client_list` c WHERE c.delete_flag = 0 
                    ORDER BY (c.opening_balance + 
                        COALESCE((SELECT SUM(amount) FROM transaction_list WHERE client_name = c.id AND status = 5), 0) + 
                        COALESCE((SELECT SUM(total_amount) FROM direct_sales WHERE client_id = c.id), 0) - 
                        COALESCE((SELECT SUM(amount + discount) FROM client_payments WHERE client_id = c.id), 0)) DESC");
                
                $i_mobile = 1;
                while($row = $qry->fetch_assoc()):
                    // UPDATED CALCULATION FOR MOBILE
                    $total_billed = $row['repair_billed'] + $row['direct_sales_billed'];
                    $current_balance = ($row['opening_balance'] + $total_billed) - $row['total_paid'];
                    $fullname = ucwords($row['firstname'] . ' ' . $row['middlename'] . ' ' . $row['lastname']);
                    
                    $card_class = '';
                    $balance_class = '';
                    if($current_balance > 0) {
                        if($current_balance > 50000) { $card_class = 'very-high-balance'; $balance_class = 'balance-very-high'; } 
                        elseif($current_balance > 20000) { $card_class = 'high-balance'; $balance_class = 'balance-high'; } 
                        else { $balance_class = 'balance-positive'; }
                    } else { $balance_class = 'balance-negative'; }
                ?>
                <div class="client-card <?php echo $card_class ?>" 
                     data-search="<?php echo htmlspecialchars(strtolower($fullname . ' ' . $row['contact'] . ' ' . $row['email'] . ' ' . $row['address'])) ?>"
                     data-balance="<?php echo $current_balance ?>">
                    
                    <div class="client-header">
                        <div class="client-avatar">
                            <img src="<?php echo validate_image($row['image_path']) ?>" 
     alt="Client"
     class="view_image_full"
     style="cursor:pointer"
     data-src="<?php echo validate_image($row['image_path']) ?>"
     onerror="this.src='<?php echo base_url ?>dist/img/no-image-available.png'">
                        </div>
                        
                        <div class="client-info">
    <a href="./?page=clients/view_client&id=<?php echo $row['id'] ?>" class="text-decoration-none">
        <div class="client-name text-primary"><?php echo $fullname ?></div>
    </a>
    <div class="client-id">ID: <?php echo $row['id'] ?> | #<?php echo $i_mobile++ ?></div>
</div>
                    </div>
                    
                    <div class="contact-info">
                        <div class="contact-item"><i class="fa fa-phone-alt text-primary"></i><span><?php echo $row['contact'] ?></span></div>
                        <div class="contact-item"><i class="fa fa-envelope text-danger"></i><span><?php echo $row['email'] ?: 'No Email' ?></span></div>
                        <?php if(!empty($row['contact'])): 
                            $wa_msg = "Namaste ". $fullname .", aapka pending balance ₹". number_format($current_balance, 2) ." hai. Kripya bhugtan karein.";
                        ?>
                        <a href="https://wa.me/91<?php echo $row['contact'] ?>?text=<?php echo urlencode($wa_msg) ?>" target="_blank" class="whatsapp-badge"><i class="fab fa-whatsapp"></i> Send WhatsApp Reminder</a>
                        <?php endif; ?>
                    </div>
                    
                    <div class="address-box">
                        <strong><i class="fa fa-map-marker-alt text-info"></i> Address:</strong>
                        <p class="mb-0 mt-1"><?php echo $row['address'] ?></p>
                    </div>
                    
                    <div class="balance-info">
                        <div>
                            <small class="text-muted">Current Balance</small>
                            <div class="balance-amount <?php echo $balance_class ?>">₹ <?php echo number_format($current_balance, 2) ?></div>
                        </div>
                        <?php if($current_balance > 20000): ?> <span class="badge badge-danger">Very High</span>
                        <?php elseif($current_balance > 10000): ?> <span class="badge badge-warning">High</span>
                        <?php elseif($current_balance > 0): ?> <span class="badge badge-info">Pending Balance</span>
                        <?php else: ?> <span class="badge badge-success">Clear</span> <?php endif; ?>
                    </div>
                    
                    <div class="card-actions">
                        <div class="btn-action-group">
                            <a href="./?page=clients/view_client&id=<?php echo $row['id'] ?>" class="btn btn-sm btn-info"><i class="far fa-eye"></i> View</a>
                            <a class="btn btn-sm btn-warning edit_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><i class="fa fa-edit"></i> Edit</a>
                        </div>
                    </div>
                </div>
                <?php endwhile; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="imagePreviewModal" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="background: transparent; border: none;">
            <div class="modal-body text-center" style="position:relative;">
                <button type="button" class="close" data-dismiss="modal" style="color: #fff; font-size: 2.5rem; position: absolute; right: 0; top: -45px; opacity: 1;">&times;</button>
                <img src="" id="preview-img" class="img-fluid rounded shadow-lg" style="max-height: 85vh; border: 3px solid #fff;">
            </div>
        </div>
    </div>
</div>

<script>
$(document).ready(function(){
    $('#client-list-main').DataTable({
        "pageLength": 25,
        "order": [[4, "desc"]],
        "responsive": false,
        "columnDefs": [
            { "orderable": false, "targets": [5] },
            { 
                "type": "num", 
                "targets": 4,
                "render": function(data, type, row) {
                    var balance = data.replace('₹', '').replace(/,/g, '').trim();
                    return type === 'sort' ? parseFloat(balance) : data;
                }
            }
        ]
    });
    
    $('#create_new').click(function(e){
        e.preventDefault();
        uni_modal("<i class='fa fa-plus'></i> Add New Client","clients/manage_client.php",'mid-large')
    });
    
    $(document).on('click', '.edit_data', function(e){
        e.preventDefault();
        uni_modal("<i class='fa fa-edit'></i> Update Client Details","clients/edit_client.php?id=" + $(this).attr('data-id'), 'mid-large');
    });
    
    $(document).on('click', '.delete_data', function(e){
        e.preventDefault();
        _conf("Are you sure to delete this client permanently?","delete_client",[$(this).attr('data-id')])
    });
    
    // Mobile Search Logic (Same as before)
    function performMobileSearch() {
        var searchTerm = $('#mobileSearchInput').val().toLowerCase().trim();
        var resultsCount = 0;
        
        if (searchTerm.length > 0) {
            $('#mobileSearchClear').show();
            $('#searchResultCount').show();
        } else {
            $('#mobileSearchClear').hide();
            $('#noResults').hide();
            $('#searchResultCount').hide();
        }
        
        $('.client-card').each(function() {
            var searchData = $(this).data('search');
            if (searchTerm.length === 0 || searchData.indexOf(searchTerm) !== -1) {
                $(this).removeClass('hidden');
                resultsCount++;
            } else {
                $(this).addClass('hidden');
            }
        });
        
        $('#countValue').text(resultsCount);
        
        if (searchTerm.length > 0 && resultsCount === 0) {
            $('#noResults').show();
            $('#searchResultCount').hide();
        } else if (searchTerm.length > 0) {
            $('#noResults').hide();
        }
    }
    
    $('#mobileSearchInput').on('input', function() { performMobileSearch(); });
    $('#mobileSearchBtn').click(function() { performMobileSearch(); });
    $('#mobileSearchClear').click(function() { $('#mobileSearchInput').val('').focus(); performMobileSearch(); });
    
    function sortMobileCards() {
        var container = $('#clientCardsContainer');
        var cards = container.find('.client-card').get();
        cards.sort(function(a, b) {
            var balanceA = parseFloat($(a).data('balance'));
            var balanceB = parseFloat($(b).data('balance'));
            return balanceB - balanceA;
        });
        $.each(cards, function(idx, card) { container.append(card); });
    }
    
    if($(window).width() <= 768) { sortMobileCards(); }
    
    
});

function printReport() {
    var printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Client List Report</title>');
    printWindow.document.write('<style>body { font-family: Arial, sans-serif; margin: 20px; } table { border-collapse: collapse; width: 100%; margin-top: 20px; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; font-weight: bold; } .text-right { text-align: right; } .text-center { text-align: center; } .high-balance { background-color: #fff5f5; } .very-high-balance { background-color: #ffe6e6; } </style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h2>Client List Report</h2><p>Date: ' + new Date().toLocaleDateString() + '</p>');
    var table = document.getElementById('client-list-main');
    if (table) { printWindow.document.write(table.outerHTML); } else { printWindow.document.write('<p>No data available</p>'); }
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function exportExcel() {
    var table = document.getElementById('client-list-main');
    var html = table.outerHTML;
    var blob = new Blob([html], {type: 'application/vnd.ms-excel'});
    var downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'client_list_' + new Date().toISOString().slice(0,10) + '.xls';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function exportPDF() {
    alert_toast("For PDF export, please use the Print button and select 'Save as PDF' in the print dialog", 'info', 5000);
    printReport();
}

// Image click par modal dikhane ka logic
    $(document).on('click', '.view_image_full', function(){
        var imgPath = $(this).attr('data-src');
        $('#preview-img').attr('src', imgPath);
        $('#imagePreviewModal').modal('show');
    });

function delete_client($id){
    start_loader();
    $.ajax({
        url: _base_url_ + "classes/Master.php?f=delete_client",
        method: "POST",
        data: {id: $id},
        dataType: "json",
        error: err => { console.log(err); alert_toast("An error occurred.",'error'); end_loader(); },
        success: function(resp){
            if(typeof resp == 'object' && resp.status == 'success'){ location.reload(); } 
            else { alert_toast("An error occurred.",'error'); end_loader(); }
        }
    })
}
</script>