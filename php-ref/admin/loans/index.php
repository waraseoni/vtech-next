<?php
// loans/index.php - Loan Management List (content for admin panel)
require_once('../config.php');
if($_settings->chk_flashdata('success')): ?>
<script>alert_toast("<?php echo $_settings->flashdata('success') ?>",'success');</script>
<?php endif; ?>

<style>
    /* --- COMMON STYLES (copied from client list) --- */
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
    
    /* --- DESKTOP TABLE SPECIFIC STYLES --- */
    .desktop-avatar {
        width: 60px;
        height: 85px;
        object-fit: cover;
        border: 2px solid #dee2e6;
        border-radius: 4px;
    }
    .client-info-cell {
        display: flex !important;
        align-items: center;
        gap: 15px;
    }
    .client-info-text h5 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
        color: #333;
    }
    .client-contact-links {
        margin-top: 4px;
        font-size: 0.85rem;
    }
    .client-contact-links a {
        margin-right: 10px;
        color: #495057;
        text-decoration: none;
    }
    .client-contact-links a:hover {
        color: #007bff;
    }
    .client-contact-links i {
        margin-right: 3px;
    }
    
    /* --- MOBILE CARD VIEW STYLES --- */
    .mobile-export-buttons { display: none; }
    
    @media (max-width: 768px) {
        .table-responsive { display: none !important; }
        .card-view { display: block !important; }
        
        .mobile-export-buttons { display: flex !important; justify-content: center; gap: 10px; margin-bottom: 15px; padding: 0 10px; }
        .desktop-export-buttons { display: none !important; }
        
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
        .client-contact-mobile {
            margin-top: 5px;
            font-size: 0.9rem;
        }
        .client-contact-mobile a {
            margin-right: 12px;
            color: #495057;
        }
        .client-contact-mobile a:hover {
            color: #007bff;
        }
        
        .contact-info { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        .contact-item { display: flex; align-items: center; margin-bottom: 8px; font-size: 0.9rem; }
        .contact-item i { width: 20px; color: #495057; margin-right: 10px; }
        
        .address-box { margin: 10px 0; padding: 10px; background: #f0f8ff; border-radius: 5px; font-size: 0.9rem; line-height: 1.4; }
        
        .balance-info { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; padding: 10px; background: #fff; border: 1px solid #e9ecef; border-radius: 5px; }
        .balance-amount { font-size: 1.3rem; font-weight: bold; }
        
        .card-actions { text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
        .btn-action-group { display: flex; gap: 10px; justify-content: center; }
        
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
        <h3 class="card-title"><b><i class="fa fa-hand-holding-usd text-primary"></i> Loan Management</b></h3>
        <div class="card-tools d-flex align-items-center">
            <div class="desktop-export-buttons">
                <button type="button" class="export-btn btn-print" id="printBtn" onclick="printReport()"><i class="fas fa-print"></i> Print</button>
                <button type="button" class="export-btn btn-pdf" id="pdfBtn" onclick="exportPDF()"><i class="fas fa-file-pdf"></i> PDF</button>
                <button type="button" class="export-btn btn-excel" id="excelBtn" onclick="exportExcel()"><i class="fas fa-file-excel"></i> Excel</button>
            </div>
            <!-- Add New Loan लिंक रूटेड किया गया -->
            <a href="./?page=loans/manage" class="btn btn-flat btn-sm btn-primary ml-2"><span class="fas fa-plus"></span> Add New Loan</a>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            <div class="mobile-export-buttons">
                <button type="button" class="export-btn btn-print" id="mobilePrintBtn" onclick="printReport()"><i class="fas fa-print"></i> Print</button>
                <button type="button" class="export-btn btn-pdf" id="mobilePdfBtn" onclick="exportPDF()"><i class="fas fa-file-pdf"></i> PDF</button>
                <button type="button" class="export-btn btn-excel" id="mobileExcelBtn" onclick="exportExcel()"><i class="fas fa-file-excel"></i> Excel</button>
            </div>

            <!-- Desktop Table View -->
            <div class="table-responsive">
                <table class="table table-hover table-striped table-bordered" id="loan-list-main">
                    <thead class="bg-navy">
                        <tr>
                            <th class="text-center" width="5%">#</th>
                            <th width="12%">Loan ID</th>
                            <th width="25%">Client</th>
                            <th width="8%">Loan Date</th>
                            <th width="15%">Loan Detail</th>
                            <th class="text-right" width="8%">Paid</th>
                            <th class="text-right" width="8%">Balance</th>
                            <th class="text-right" width="8%">EMI Amount</th>
                            <th class="text-center" width="6%">Status</th>
                            <th class="text-center" width="5%">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $i = 1;
                        $qry = $conn->query("SELECT l.*, 
                            CONCAT(c.firstname,' ',c.middlename,' ',c.lastname) as client_name,
                            c.image_path, c.contact
                            FROM client_loans l 
                            LEFT JOIN client_list c ON l.client_id = c.id 
                            WHERE c.delete_flag = 0 
                            ORDER BY l.loan_date DESC, l.id DESC");
                        
                        $total_payable_sum = 0;
                        $total_paid_sum = 0;
                        $total_balance_sum = 0;
                        
                        while($row = $qry->fetch_assoc()):
                            // Calculate paid amount from client_payments
                            $paid_qry = $conn->query("SELECT SUM(amount + discount) as paid FROM client_payments WHERE loan_id = '{$row['id']}'");
                            $paid = $paid_qry->fetch_assoc()['paid'] ?? 0;
                            $balance = $row['total_payable'] - $paid;
                            
                            $total_payable_sum += $row['total_payable'];
                            $total_paid_sum += $paid;
                            $total_balance_sum += $balance;
                            
                            // Determine row class based on balance
                            $row_class = '';
                            $balance_class = '';
                            if($balance > 0) {
                                if($balance > 50000) { 
                                    $row_class = 'very-high-balance'; 
                                    $balance_class = 'balance-very-high'; 
                                } elseif($balance > 20000) { 
                                    $row_class = 'high-balance'; 
                                    $balance_class = 'balance-high'; 
                                } else { 
                                    $balance_class = 'balance-positive'; 
                                }
                            } else {
                                $balance_class = 'balance-negative';
                            }

                            // Safely extract principal and tenure with fallbacks
                            $principal = $row['principal'] ?? $row['principal_amount'] ?? $row['amount'] ?? 0;
                            $tenure = $row['tenure'] ?? $row['duration'] ?? $row['tenure_months'] ?? 0;
                            $interest_rate = $row['interest_rate'] ?? 0;
                            
                            // Prepare contact for links (strip non-digits for WhatsApp)
                            $contact_raw = $row['contact'] ?? '';
                            $contact_digits = preg_replace('/[^0-9]/', '', $contact_raw);
                        ?>
                        <tr class="<?php echo $row_class ?>" data-balance="<?php echo $balance ?>" data-loan-id="<?php echo $row['id'] ?>">
                            <td class="text-center align-middle"><?php echo $i++; ?></td>
                            <td class="align-middle">LN-<?php echo str_pad($row['id'], 5, '0', STR_PAD_LEFT) ?></td>
                            <td>
                                <div class="client-info-cell">
                                    <img src="<?php echo validate_image($row['image_path']) ?>" 
                                         class="desktop-avatar view_image_full" 
                                         alt="Client"
                                         style="cursor:pointer"
                                         data-src="<?php echo validate_image($row['image_path']) ?>"
                                         onerror="this.src='<?php echo base_url ?>dist/img/no-image-available.png'">
                                    <div class="client-info-text">
                                        <a href="./?page=clients/view_client&id=<?php echo $row['client_id'] ?>" class="text-decoration-none">
                                            <h5 class="text-primary"><?php echo $row['client_name'] ?></h5>
                                        </a>
                                        <small class="text-muted">ID: <?php echo $row['client_id'] ?></small>
                                        <?php if(!empty($contact_raw)): ?>
                                        <div class="client-contact-links">
                                            <a href="tel:<?php echo urlencode($contact_raw) ?>" title="Call">
                                                <i class="fas fa-phone-alt"></i> <?php echo htmlspecialchars($contact_raw) ?>
                                            </a>
                                            <a href="https://wa.me/<?php echo $contact_digits ?>" target="_blank" title="WhatsApp">
                                                <i class="fab fa-whatsapp"></i>
                                            </a>
                                        </div>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </td>
                            <td class="align-middle"><?php echo date("d-m-Y", strtotime($row['loan_date'])) ?></td>
                            <td class="align-middle">
                                <!-- Loan Detail: Principal, Interest, Tenure, Final Payable -->
                                <div><strong>Principal:</strong> ₹<?php echo number_format($principal,2) ?></div>
                                <div><strong>Interest:</strong> <?php echo $interest_rate ?>%</div>
                                <div><strong>Tenure:</strong> <?php echo $tenure ?> months</div>
                                <div><strong>Total:</strong> ₹<?php echo number_format($row['total_payable'],2) ?></div>
                            </td>
                            <td class="text-right align-middle text-success">₹<?php echo number_format($paid,2) ?></td>
                            <td class="text-right align-middle font-weight-bold <?php echo $balance_class ?>">₹<?php echo number_format($balance,2) ?></td>
                            <td class="text-right align-middle">₹<?php echo number_format($row['emi_amount'],2) ?></td>
                            <td class="text-center align-middle">
                                <?php if($row['status'] == 1): ?>
                                    <span class="badge badge-success">Active</span>
                                <?php else: ?>
                                    <span class="badge badge-secondary">Closed</span>
                                <?php endif; ?>
                            </td>
                            <td align="center" class="align-middle">
                                <div class="btn-group">
                                    <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">Action</button>
                                    <div class="dropdown-menu" role="menu">
                                        <!-- View लिंक पहले से रूटेड है -->
                                        <a class="dropdown-item" href="./?page=loans/view&id=<?php echo $row['id'] ?>"><span class="fa fa-eye text-primary"></span> View</a>
                                        <div class="dropdown-divider"></div>
                                        <!-- Edit लिंक रूटेड किया गया -->
                                        <a class="dropdown-item" href="./?page=loans/manage&id=<?php echo $row['id'] ?>"><span class="fa fa-edit text-info"></span> Edit</a>
                                        <div class="dropdown-divider"></div>
                                        <?php if($row['status'] == 1): ?>
										<?php if($balance > 0): ?>
											<a class="dropdown-item force_close_loan" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>" data-balance="<?php echo $balance ?>"><span class="fa fa-exclamation-triangle text-danger"></span> Force Close</a>
										<?php else: ?>
											<a class="dropdown-item close_loan" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-lock text-warning"></span> Close Loan</a>
										<?php endif; ?>
											<div class="dropdown-divider"></div>
										<?php endif; ?>
                                        <a class="dropdown-item delete_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                    <tfoot>
                        <tr class="bg-light">
                            <th colspan="4" class="text-right">Total:</th>
                            <th class="text-right">₹ <?php echo number_format($total_payable_sum, 2) ?></th>
                            <th class="text-right">₹ <?php echo number_format($total_paid_sum, 2) ?></th>
                            <th class="text-right">₹ <?php echo number_format($total_balance_sum, 2) ?></th>
                            <th colspan="3"></th>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Mobile Card View -->
            <div class="card-view">
                <div class="mobile-search-container">
                    <input type="text" class="mobile-search-input" id="mobileSearchInput" placeholder="Search loans...">
                    <button type="button" class="mobile-search-clear" id="mobileSearchClear"><i class="fas fa-times"></i></button>
                    <button type="button" class="mobile-search-btn" id="mobileSearchBtn"><i class="fas fa-search"></i></button>
                </div>
                
                <div class="no-results" id="noResults" style="display: none;">
                    <i class="fas fa-search"></i><h5>No Loans Found</h5>
                </div>
                <div id="searchResultCount" class="px-3 mb-2 text-muted" style="display:none; font-size: 0.9rem;">
                    Found <span id="countValue" class="font-weight-bold text-primary">0</span> results
                </div>
                
                <div id="loanCardsContainer">
                <?php 
                $qry_mobile = $conn->query("SELECT l.*, 
                    CONCAT(c.firstname,' ',c.middlename,' ',c.lastname) as client_name,
                    c.image_path, c.contact, c.email, c.address
                    FROM client_loans l 
                    LEFT JOIN client_list c ON l.client_id = c.id 
                    WHERE c.delete_flag = 0 
                    ORDER BY l.loan_date DESC, l.id DESC");
                
                $i_mobile = 1;
                while($row = $qry_mobile->fetch_assoc()):
                    $paid_qry = $conn->query("SELECT SUM(amount + discount) as paid FROM client_payments WHERE loan_id = '{$row['id']}'");
                    $paid = $paid_qry->fetch_assoc()['paid'] ?? 0;
                    $balance = $row['total_payable'] - $paid;
                    
                    $card_class = '';
                    $balance_class = '';
                    if($balance > 0) {
                        if($balance > 50000) { 
                            $card_class = 'very-high-balance'; 
                            $balance_class = 'balance-very-high'; 
                        } elseif($balance > 20000) { 
                            $card_class = 'high-balance'; 
                            $balance_class = 'balance-high'; 
                        } else { 
                            $balance_class = 'balance-positive'; 
                        }
                    } else {
                        $balance_class = 'balance-negative';
                    }

                    // Safely extract principal and tenure with fallbacks
                    $principal = $row['principal'] ?? $row['principal_amount'] ?? $row['amount'] ?? 0;
                    $tenure = $row['tenure'] ?? $row['duration'] ?? $row['tenure_months'] ?? 0;
                    $interest_rate = $row['interest_rate'] ?? 0;
                    
                    // Prepare contact for links
                    $contact_raw = $row['contact'] ?? '';
                    $contact_digits = preg_replace('/[^0-9]/', '', $contact_raw);
                ?>
                <div class="client-card <?php echo $card_class ?>" 
                     data-search="<?php echo htmlspecialchars(strtolower($row['client_name'] . ' ' . $row['contact'] . ' ' . $row['email'] . ' ' . $row['address'])) ?>"
                     data-balance="<?php echo $balance ?>"
                     data-loan-id="<?php echo $row['id'] ?>">
                    
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
                            <!-- View लिंक रूटेड है -->
                            <a href="./?page=loans/view&id=<?php echo $row['id'] ?>" class="text-decoration-none">
                                <div class="client-name text-primary">LN-<?php echo str_pad($row['id'], 5, '0', STR_PAD_LEFT) ?></div>
                            </a>
                            <div class="client-id">Client: <?php echo $row['client_name'] ?> | #<?php echo $i_mobile++ ?></div>
                            <?php if(!empty($contact_raw)): ?>
                            <div class="client-contact-mobile">
                                <a href="tel:<?php echo urlencode($contact_raw) ?>" title="Call">
                                    <i class="fas fa-phone-alt"></i> <?php echo htmlspecialchars($contact_raw) ?>
                                </a>
                                <a href="https://wa.me/<?php echo $contact_digits ?>" target="_blank" title="WhatsApp">
                                    <i class="fab fa-whatsapp"></i>
                                </a>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>
                    
                    <div class="contact-info">
                        <div class="contact-item"><i class="fa fa-calendar-alt text-primary"></i><span>Loan Date: <?php echo date("d-m-Y", strtotime($row['loan_date'])) ?></span></div>
                        <!-- Loan details: principal, interest, tenure, final payable -->
                        <div class="contact-item"><i class="fa fa-rupee-sign text-success"></i><span>Principal: ₹<?php echo number_format($principal,2) ?></span></div>
                        <div class="contact-item"><i class="fa fa-percent text-info"></i><span>Interest: <?php echo $interest_rate ?>%</span></div>
                        <div class="contact-item"><i class="fa fa-calendar-alt text-warning"></i><span>Tenure: <?php echo $tenure ?> months</span></div>
                        <div class="contact-item"><i class="fa fa-money-bill-wave text-success"></i><span>Total Payable: ₹<?php echo number_format($row['total_payable'],2) ?></span></div>
                        <div class="contact-item"><i class="fa fa-check-circle text-success"></i><span>Paid: ₹<?php echo number_format($paid,2) ?></span></div>
                        <div class="contact-item"><i class="fa fa-chart-line text-warning"></i><span>EMI: ₹<?php echo number_format($row['emi_amount'],2) ?></span></div>
                    </div>
                    
                    <div class="address-box">
                        <strong><i class="fa fa-map-marker-alt text-info"></i> Client Address:</strong>
                        <p class="mb-0 mt-1"><?php echo $row['address'] ?></p>
                    </div>
                    
                    <div class="balance-info">
                        <div>
                            <small class="text-muted">Current Balance</small>
                            <div class="balance-amount <?php echo $balance_class ?>">₹ <?php echo number_format($balance, 2) ?></div>
                        </div>
                        <span class="badge badge-info"><?php echo $row['status']==1 ? 'Active' : 'Closed' ?></span>
                    </div>
                    
                    <div class="card-actions">
                        <div class="btn-action-group">
                            <!-- View लिंक रूटेड है -->
                            <a href="./?page=loans/view&id=<?php echo $row['id'] ?>" class="btn btn-sm btn-info"><i class="far fa-eye"></i> View</a>
                            <!-- Edit लिंक रूटेड किया गया -->
                            <a href="./?page=loans/manage&id=<?php echo $row['id'] ?>" class="btn btn-sm btn-warning"><i class="fa fa-edit"></i> Edit</a>
                         <!--   <?php if($row['status'] == 1): ?>
    <?php if($balance > 0): ?>
        <button class="btn btn-sm btn-danger force_close_loan" data-id="<?php echo $row['id'] ?>" data-balance="<?php echo $balance ?>"><i class="fa fa-exclamation-triangle"></i> Force Close</button>
    <?php else: ?>
        <button class="btn btn-sm btn-secondary close_loan" data-id="<?php echo $row['id'] ?>"><i class="fa fa-lock"></i> Close</button>
    <?php endif; ?>
<?php endif; ?>-->
                        </div>
                    </div>
                </div>
                <?php endwhile; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Image Preview Modal (same as client list) -->
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
    // Initialize DataTable with updated column definitions
    $('#loan-list-main').DataTable({
        "pageLength": 25,
        "order": [[3, "desc"]], // order by Loan Date
        "responsive": false,
        "columnDefs": [
            { "orderable": false, "targets": [4,9] }, // Disable sorting on Loan Detail and Action
            { 
                "type": "num", 
                "targets": [5,6,7], // Paid, Balance, EMI are numeric
                "render": function(data, type, row) {
                    var num = data.replace('₹', '').replace(/,/g, '').trim();
                    return type === 'sort' ? parseFloat(num) : data;
                }
            }
        ]
    });
	
	$(document).on('click', '.close_loan', function(e){
    e.preventDefault();
    _conf("Are you sure to close this loan? (Balance is zero)", "close_loan", [$(this).attr('data-id')])
});

$(document).on('click', '.force_close_loan', function(e){
    e.preventDefault();
    var balance = $(this).data('balance');
    _conf("Warning: This loan has a pending balance of ₹" + parseFloat(balance).toFixed(2) + ". Are you sure you want to force close it? This will write off the remaining amount.", "close_loan", [$(this).attr('data-id')])
});

    // Mobile search logic
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
    
    $('#mobileSearchInput').on('input', performMobileSearch);
    $('#mobileSearchBtn').click(performMobileSearch);
    $('#mobileSearchClear').click(function() { 
        $('#mobileSearchInput').val('').focus(); 
        performMobileSearch(); 
    });

    // Sort mobile cards by balance descending
    function sortMobileCards() {
        var container = $('#loanCardsContainer');
        var cards = container.find('.client-card').get();
        cards.sort(function(a, b) {
            var balanceA = parseFloat($(a).data('balance'));
            var balanceB = parseFloat($(b).data('balance'));
            return balanceB - balanceA;
        });
        $.each(cards, function(idx, card) { container.append(card); });
    }
    if($(window).width() <= 768) { sortMobileCards(); }

    // Action buttons
    $(document).on('click', '.close_loan', function(e){
        e.preventDefault();
        _conf("Are you sure to close this loan?", "close_loan", [$(this).attr('data-id')])
    });

    $(document).on('click', '.delete_data', function(e){
        e.preventDefault();
        _conf("Are you sure to delete this loan? This will unlink all related payments.", "delete_loan", [$(this).attr('data-id')])
    });

    // Image preview
    $(document).on('click', '.view_image_full', function(){
        var imgPath = $(this).attr('data-src');
        $('#preview-img').attr('src', imgPath);
        $('#imagePreviewModal').modal('show');
    });
});

function printReport() {
    var printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Loan List Report</title>');
    printWindow.document.write('<style>body { font-family: Arial, sans-serif; margin: 20px; } table { border-collapse: collapse; width: 100%; margin-top: 20px; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; font-weight: bold; } .text-right { text-align: right; } .text-center { text-align: center; } .high-balance { background-color: #fff5f5; } .very-high-balance { background-color: #ffe6e6; } </style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h2>Loan List Report</h2><p>Date: ' + new Date().toLocaleDateString() + '</p>');
    var table = document.getElementById('loan-list-main');
    if (table) { printWindow.document.write(table.outerHTML); } else { printWindow.document.write('<p>No data available</p>'); }
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function exportExcel() {
    var table = document.getElementById('loan-list-main');
    var html = table.outerHTML;
    var blob = new Blob([html], {type: 'application/vnd.ms-excel'});
    var downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'loan_list_' + new Date().toISOString().slice(0,10) + '.xls';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function exportPDF() {
    alert_toast("For PDF export, please use the Print button and select 'Save as PDF' in the print dialog", 'info', 5000);
    printReport();
}

function close_loan($id){
    start_loader();
    $.ajax({
        url:_base_url_+"classes/Master.php?f=close_loan",
        method:"POST",
        data:{id:$id},
        dataType:"json",
        error:err=>{
            console.log(err)
            alert_toast("An error occured.",'error');
            end_loader();
        },
        success:function(resp){
            if(typeof resp== 'object' && resp.status == 'success'){
                location.reload();
            }else{
                alert_toast("An error occured.",'error');
                end_loader();
            }
        }
    });
}

// Updated delete function to use Master.php?f=delete_client_loan
function delete_loan($id) {
    start_loader();
    $.ajax({
        url: _base_url_ + "classes/Master.php?f=delete_client_loan",
        method: "POST",
        data: {id: $id},
        dataType: "json",
        error: err => { console.log(err); alert_toast("An error occurred.",'error'); end_loader(); },
        success: function(resp) {
            if(typeof resp == 'object' && resp.status == 'success') {
                alert_toast("Loan deleted successfully.", 'success');
                location.reload();
            } else {
                alert_toast("An error occurred.", 'error');
                end_loader();
            }
        }
    });
}
</script>