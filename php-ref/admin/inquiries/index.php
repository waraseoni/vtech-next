<?php if($_settings->chk_flashdata('success')): ?>
<script>alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')</script>
<?php endif;?>

<?php
// ==============================================================
// FILTER HANDLING
// ==============================================================
$from = isset($_GET['from']) && !empty($_GET['from']) ? $_GET['from'] : date('Y-m-01');
$to   = isset($_GET['to']) && !empty($_GET['to']) ? $_GET['to'] : date('Y-m-t');
$status_filter = isset($_GET['status']) ? $_GET['status'] : '';

// Build WHERE clause
$where = "WHERE 1=1";
if(!empty($from)){
    $where .= " AND DATE(date_created) >= '$from'";
}
if(!empty($to)){
    $where .= " AND DATE(date_created) <= '$to'";
}
if($status_filter === 'read'){
    $where .= " AND status = 1";
} elseif($status_filter === 'unread'){
    $where .= " AND status = 0";
}
// Note: 'all' or empty means no status filter
?>

<style>
    /* --- COMMON STYLES --- */
    .truncate-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 250px;
    }
    
    /* Summary Cards */
    .summary-cards {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        margin-bottom: 20px;
        padding: 10px 15px;
        background: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #dee2e6;
    }
    .summary-item {
        flex: 1 1 200px;
        background: white;
        padding: 10px 15px;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-left: 4px solid #007bff;
    }
    .summary-item .label {
        font-size: 0.85rem;
        color: #6c757d;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .summary-item .value {
        font-size: 1.5rem;
        font-weight: 600;
        color: #343a40;
    }

    /* Filter Bar */
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

    /* --- MOBILE CARD VIEW --- */
    .mobile-export-buttons { display: none; }

    @media (max-width: 768px) {
        .table-responsive { display: none !important; }
        .card-view { display: block !important; }

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

        /* Status filter tabs for mobile */
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

        /* Inquiry Card */
        .inquiry-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 15px;
            padding: 15px;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        .inquiry-card.hidden {
            display: none !important;
        }
        .inquiry-card:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }
        .inquiry-card .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }
        .inquiry-card .inquirer {
            font-weight: bold;
            color: #007bff;
            font-size: 1.1rem;
        }
        .inquiry-card .date {
            color: #6c757d;
            font-size: 0.9rem;
        }
        .inquiry-card .contact-info {
            margin-bottom: 10px;
        }
        .inquiry-card .contact-item {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
            font-size: 0.9rem;
        }
        .inquiry-card .contact-item i {
            width: 20px;
            color: #495057;
            margin-right: 10px;
        }
        .inquiry-card .message-box {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            font-size: 0.9rem;
            line-height: 1.4;
            max-height: 80px;
            overflow-y: auto;
        }
        .inquiry-card .status-badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .inquiry-card .card-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 10px;
            border-top: 1px solid #eee;
        }
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
        .inquiry-card {
            display: none !important;
        }
        .no-results {
            display: none !important;
        }
        .mobile-export-buttons {
            display: none !important;
        }
    }

    /* Print styles */
    @media print {
        .filter-bar,
        .card-tools,
        .btn-group,
        .dropdown-toggle,
        .mobile-export-buttons,
        .mobile-search-container,
        .status-filter-container,
        .card-view,
        .summary-cards {
            display: none !important;
        }
        .table-responsive {
            display: block !important;
        }
        table {
            font-size: 11px;
        }
        th, td {
            padding: 4px !important;
        }
    }
</style>

<div class="card card-outline card-info rounded-0">
    <div class="card-header">
        <h3 class="card-title">List of Inquiries</h3>
        <div class="card-tools d-flex align-items-center">
            <!-- Optional export buttons could go here -->
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">

            <?php
            // Get summary counts
            $total_qry = $conn->query("SELECT COUNT(*) as total FROM message_list $where");
            $total = $total_qry->fetch_assoc()['total'];

            $unread_qry = $conn->query("SELECT COUNT(*) as unread FROM message_list WHERE status = 0");
            $unread = $unread_qry->fetch_assoc()['unread'];
            $read_qry = $conn->query("SELECT COUNT(*) as read_count FROM message_list WHERE status = 1");
            $read = $read_qry->fetch_assoc()['read_count'];

            // For filtered totals (used in summary cards maybe)
            $filtered_total = $total;
            ?>

            <!-- Summary Cards -->
            <div class="summary-cards">
                <div class="summary-item">
                    <div class="label">Total Inquiries</div>
                    <div class="value"><?= $total ?></div>
                </div>
                <div class="summary-item">
                    <div class="label">Unread</div>
                    <div class="value text-primary"><?= $unread ?></div>
                </div>
                <div class="summary-item">
                    <div class="label">Read</div>
                    <div class="value text-success"><?= $read ?></div>
                </div>
            </div>

            <!-- Filter Bar with month navigation -->
            <form action="" method="GET" id="filter-form" class="mb-4 no-print">
                <input type="hidden" name="page" value="inquiries/index">
                <div class="filter-bar">
                    <input type="date" name="from" class="filter-input" value="<?= htmlspecialchars($from) ?>" placeholder="From Date">
                    <input type="date" name="to" class="filter-input" value="<?= htmlspecialchars($to) ?>" placeholder="To Date">
                    <select name="status" class="filter-input">
                        <option value="all" <?= $status_filter == 'all' || $status_filter == '' ? 'selected' : '' ?>>All Status</option>
                        <option value="unread" <?= $status_filter == 'unread' ? 'selected' : '' ?>>Unread</option>
                        <option value="read" <?= $status_filter == 'read' ? 'selected' : '' ?>>Read</option>
                    </select>
                    <button class="filter-btn" type="submit"><i class="fas fa-filter"></i> Apply</button>
                    
                    <!-- Month navigation buttons -->
                    <button type="button" class="filter-btn nav-btn" id="prevMonthBtn"><i class="fa fa-chevron-left"></i> Previous Month</button>
                    <button type="button" class="filter-btn nav-btn" id="nextMonthBtn">Next Month <i class="fa fa-chevron-right"></i></button>
                    <button type="button" class="filter-btn reset" id="currentMonthBtn"><i class="fa fa-refresh"></i> Current Month</button>
                    
                    <a href="./?page=inquiries/index" class="filter-btn reset"><i class="fas fa-undo"></i> Reset All</a>
                    
                    <?php if(!empty($from) || !empty($to) || !empty($status_filter) && $status_filter != 'all'): ?>
                    <span id="filterResultCount">Showing <?= $filtered_total ?> results</span>
                    <?php endif; ?>
                </div>
            </form>

            <!-- Desktop Table with added Date column -->
            <div class="table-responsive">
                <table class="table table-hover table-striped">
                    <colgroup>
                        <col width="5%">
                        <col width="15%">
                        <col width="10%">
                        <col width="15%">
                        <col width="10%">  <!-- Date column -->
                        <col width="25%">  <!-- Message -->
                        <col width="7.5%">
                        <col width="7.5%">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Inquirer</th>
                            <th>Contact</th>
                            <th>Email</th>
                            <th>Date</th>
                            <th>Message</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $i = 1;
                        $qry = $conn->query("SELECT * FROM `message_list` $where ORDER BY status ASC, unix_timestamp(date_created) DESC");
                        while($row = $qry->fetch_assoc()):
                        ?>
                        <tr>
                            <td class="text-center"><?php echo $i++; ?></td>
                            <td><?php echo ucwords($row['fullname']) ?></td>
                            <td><?php echo ($row['contact']) ?></td>
                            <td><?php echo ($row['email']) ?></td>
                            <td><?php echo date("d-m-Y", strtotime($row['date_created'])) ?></td>
                            <td class="truncate-1"><?php echo ($row['message']) ?></td>
                            <td class="text-center">
                                <?php if($row['status'] == 1): ?>
                                    <span class="badge badge-pill badge-success">Read</span>
                                <?php else: ?>
                                    <span class="badge badge-pill badge-primary">Unread</span>
                                <?php endif; ?>
                            </td>
                            <td align="center">
                                <div class="btn-group">
                                    <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">
                                        Action
                                        <span class="sr-only">Toggle Dropdown</span>
                                    </button>
                                    <div class="dropdown-menu" role="menu">
                                        <a class="dropdown-item view_details" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-eye text-dark"></span> View</a>
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

            <!-- Mobile Card View (unchanged, already shows date) -->
            <div class="card-view">
                <!-- Mobile Search Bar -->
                <div class="mobile-search-container">
                    <input type="text" class="mobile-search-input" id="mobileSearchInput" placeholder="Search by name, contact, email or message...">
                    <button type="button" class="mobile-search-clear" id="mobileSearchClear"><i class="fas fa-times"></i></button>
                    <button type="button" class="mobile-search-btn" id="mobileSearchBtn"><i class="fas fa-search"></i></button>
                    <div class="mobile-search-info" id="searchInfo">Found <span id="resultCount">0</span> inquiries</div>
                </div>

                <!-- Status Filter Tabs (mobile) -->
                <div class="status-filter-container">
                    <button type="button" class="status-filter-btn active" data-filter="all">All</button>
                    <button type="button" class="status-filter-btn" data-filter="unread">Unread</button>
                    <button type="button" class="status-filter-btn" data-filter="read">Read</button>
                </div>

                <!-- No Results Message -->
                <div class="no-results" id="noResults" style="display: none;">
                    <i class="fas fa-inbox"></i>
                    <h5>No Inquiries Found</h5>
                    <p>Try changing your search or filters</p>
                </div>

                <!-- Cards Container -->
                <div id="inquiryCardsContainer">
                    <?php 
                    // Re-fetch for mobile cards (using same filtered data)
                    $qry = $conn->query("SELECT * FROM `message_list` $where ORDER BY status ASC, unix_timestamp(date_created) DESC");
                    $card_i = 1;
                    while($row = $qry->fetch_assoc()):
                        $fullname = ucwords($row['fullname']);
                        $contact = $row['contact'];
                        $email = $row['email'];
                        $message = $row['message'];
                        $status = $row['status'];
                        $date = date("M d, Y", strtotime($row['date_created']));
                        $search_text = strtolower($fullname . ' ' . $contact . ' ' . $email . ' ' . $message);
                    ?>
                    <div class="inquiry-card" 
                         data-search="<?= htmlspecialchars($search_text) ?>"
                         data-status="<?= $status ?>"
                         data-id="<?= $row['id'] ?>">
                        <div class="card-header">
                            <div class="inquirer"><?= $fullname ?></div>
                            <div class="date"><?= $date ?></div>
                        </div>
                        <div class="contact-info">
                            <div class="contact-item"><i class="fa fa-phone-alt text-primary"></i> <?= $contact ?></div>
                            <div class="contact-item"><i class="fa fa-envelope text-danger"></i> <?= $email ?></div>
                        </div>
                        <div class="message-box"><?= nl2br(htmlspecialchars($message)) ?></div>
                        <div style="text-align: right; margin-bottom: 10px;">
                            <?php if($status == 1): ?>
                                <span class="badge badge-success">Read</span>
                            <?php else: ?>
                                <span class="badge badge-primary">Unread</span>
                            <?php endif; ?>
                        </div>
                        <div class="card-actions">
                            <button type="button" class="btn btn-sm btn-info view_details" data-id="<?= $row['id'] ?>">
                                <i class="fa fa-eye"></i> View
                            </button>
                            <button type="button" class="btn btn-sm btn-danger delete_data" data-id="<?= $row['id'] ?>">
                                <i class="fa fa-trash"></i> Delete
                            </button>
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
    // DataTable initialization for desktop (with new date column)
    var table = $('.table').DataTable({
        "pageLength": 25,
        "order": [[4, "desc"]], // Sort by date column (index 4) descending
        "responsive": true,
        "columnDefs": [
            { "orderable": false, "targets": [7] } // Action column
        ]
    });

    // Helper functions for date navigation
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

    // Month navigation buttons
    $('#prevMonthBtn').click(function() {
        var fromDate = new Date($('input[name="from"]').val() + 'T00:00:00');
        var baseDate = isNaN(fromDate.getTime()) ? new Date() : fromDate;
        var prevMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
        var firstDay = getFirstDayOfMonth(prevMonth);
        var lastDay = getLastDayOfMonth(prevMonth);
        $('input[name="from"]').val(formatDate(firstDay));
        $('input[name="to"]').val(formatDate(lastDay));
        $('#filter-form').submit();
    });

    $('#nextMonthBtn').click(function() {
        var fromDate = new Date($('input[name="from"]').val() + 'T00:00:00');
        var baseDate = isNaN(fromDate.getTime()) ? new Date() : fromDate;
        var nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
        var firstDay = getFirstDayOfMonth(nextMonth);
        var lastDay = getLastDayOfMonth(nextMonth);
        $('input[name="from"]').val(formatDate(firstDay));
        $('input[name="to"]').val(formatDate(lastDay));
        $('#filter-form').submit();
    });

    $('#currentMonthBtn').click(function() {
        var today = new Date();
        var firstDay = getFirstDayOfMonth(today);
        var lastDay = getLastDayOfMonth(today);
        $('input[name="from"]').val(formatDate(firstDay));
        $('input[name="to"]').val(formatDate(lastDay));
        // Do not change status filter, keep as is
        $('#filter-form').submit();
    });

    // Mobile search and filter
    var currentFilter = 'all';
    var currentSearch = '';

    function performMobileSearchAndFilter() {
        var searchTerm = $('#mobileSearchInput').val().toLowerCase().trim();
        var filterType = currentFilter;
        var resultsCount = 0;

        // Show/hide clear button
        if (searchTerm.length > 0) {
            $('#mobileSearchClear').show();
        } else {
            $('#mobileSearchClear').hide();
        }

        $('.inquiry-card').each(function() {
            var card = $(this);
            var searchData = card.data('search') || '';
            var cardStatus = card.data('status'); // 0 = unread, 1 = read
            var showCard = true;

            // Apply search filter
            if (searchTerm.length > 0 && searchData.indexOf(searchTerm) === -1) {
                showCard = false;
            }

            // Apply status filter
            if (filterType === 'unread' && cardStatus != 0) {
                showCard = false;
            } else if (filterType === 'read' && cardStatus != 1) {
                showCard = false;
            }

            if (showCard) {
                card.removeClass('hidden');
                resultsCount++;
            } else {
                card.addClass('hidden');
            }
        });

        // Update results info
        if (searchTerm.length > 0 || filterType !== 'all') {
            $('#resultCount').text(resultsCount);
            $('#searchInfo').show();
            if (resultsCount === 0) {
                $('#noResults').show();
            } else {
                $('#noResults').hide();
            }
        } else {
            $('#searchInfo').hide();
            $('#noResults').hide();
        }
        currentSearch = searchTerm;
    }

    // Search events
    $('#mobileSearchInput').on('input', performMobileSearchAndFilter);
    $('#mobileSearchBtn').click(performMobileSearchAndFilter);
    $('#mobileSearchClear').click(function() {
        $('#mobileSearchInput').val('').focus();
        performMobileSearchAndFilter();
    });
    $('#mobileSearchInput').keypress(function(e) {
        if (e.which == 13) performMobileSearchAndFilter();
    });

    // Status filter tabs (mobile)
    $('.status-filter-btn').click(function() {
        $('.status-filter-btn').removeClass('active');
        $(this).addClass('active');
        currentFilter = $(this).data('filter');
        performMobileSearchAndFilter();
    });

    // Initial call to set proper counts
    performMobileSearchAndFilter();

    // View details (opens modal)
    $(document).on('click', '.view_details', function(e) {
        e.stopPropagation();
        var id = $(this).data('id');
        uni_modal('Inquiry Details', "inquiries/view_details.php?id=" + id, 'mid-large');
    });

    // Delete
    $(document).on('click', '.delete_data', function(e) {
        e.stopPropagation();
        _conf("Are you sure to delete this Inquiry permanently?", "delete_message", [$(this).data('id')]);
    });

    // Reload after modal closes (to update read status)
    $('#uni_modal').on('hide.bs.modal', function() {
        location.reload();
    });
});

function delete_message($id) {
    start_loader();
    $.ajax({
        url: _base_url_ + "classes/Master.php?f=delete_message",
        method: "POST",
        data: { id: $id },
        dataType: "json",
        error: err => {
            console.log(err);
            alert_toast("An error occurred.", 'error');
            end_loader();
        },
        success: function(resp) {
            if (typeof resp == 'object' && resp.status == 'success') {
                location.reload();
            } else {
                alert_toast("An error occurred.", 'error');
                end_loader();
            }
        }
    });
}

function verify_user($id) {
    start_loader();
    $.ajax({
        url: _base_url_ + "classes/Users.php?f=verify_inquiries",
        method: "POST",
        data: { id: $id },
        dataType: "json",
        error: err => {
            console.log(err);
            alert_toast("An error occurred.", 'error');
            end_loader();
        },
        success: function(resp) {
            if (typeof resp == 'object' && resp.status == 'success') {
                location.reload();
            } else {
                alert_toast("An error occurred.", 'error');
                end_loader();
            }
        }
    });
}
</script>