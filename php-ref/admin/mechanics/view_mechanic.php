<?php
require_once('../config.php');

if(isset($_GET['id']) && $_GET['id'] > 0){
    $qry = $conn->query("SELECT *, CONCAT(firstname,' ',lastname) as name FROM `mechanic_list` WHERE id = '{$_GET['id']}'");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){ $$k=$v; }
    }
}

// Get avatar URL similar to index.php
$avatar = isset($avatar) && !empty($avatar) ? $avatar : 'default-avatar.jpg';
$avatar_url = validate_image('uploads/avatars/'.$avatar);

// Date Range Filter (Default: Current Month)
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-d");

// Calculate last month and next month dates
$last_month_from = date("Y-m-01", strtotime("-1 month", strtotime($from)));
$last_month_to = date("Y-m-t", strtotime("-1 month", strtotime($from)));
$next_month_from = date("Y-m-01", strtotime("+1 month", strtotime($from)));
$next_month_to = date("Y-m-t", strtotime("+1 month", strtotime($from)));

// =========================================================
// PART 1: OVERALL / LIFETIME DATA (Matching salary_report.php)
// =========================================================

// 1. All Time Salary (Including History & Half Days)
$all_time_salary = 0;
$history_att = $conn->query("SELECT curr_date, status FROM attendance_list WHERE mechanic_id = '{$id}' AND status IN (1,3)");
while($h_row = $history_att->fetch_assoc()){
    $check_date = $h_row['curr_date'];
    $h_status = $h_row['status'];
    
    $rate_qry = $conn->query("SELECT salary FROM mechanic_salary_history WHERE mechanic_id = '{$id}' AND effective_date <= '$check_date' ORDER BY effective_date DESC, id DESC LIMIT 1");
    $rate = ($rate_qry->num_rows > 0) ? $rate_qry->fetch_assoc()['salary'] : $daily_salary;
    
    if($h_status == 3) $all_time_salary += ($rate / 2);
    else $all_time_salary += $rate;
}

// 2. All Time Commission (Using date_created to match report)
$all_time_comm = $conn->query("SELECT SUM(mechanic_commission_amount) FROM transaction_list WHERE mechanic_id = '{$id}'")->fetch_array()[0] ?? 0;

// 3. All Time Paid
$all_time_paid = $conn->query("SELECT SUM(amount) FROM advance_payments WHERE mechanic_id = '{$id}'")->fetch_array()[0] ?? 0;

// 4. FINAL NET PAYABLE (Balance)
$net_payable_overall = ($all_time_salary + $all_time_comm) - $all_time_paid;


// =========================================================
// PART 2: FILTERED DATA (For the UI Boxes)
// =========================================================

$filtered_salary = 0;
$f_att_qry = $conn->query("SELECT curr_date, status FROM attendance_list WHERE mechanic_id = '{$id}' AND status IN (1,3) AND curr_date BETWEEN '{$from}' AND '{$to}'");
while($f_row = $f_att_qry->fetch_assoc()){
    $c_date = $f_row['curr_date'];
    $rate_c_qry = $conn->query("SELECT salary FROM mechanic_salary_history WHERE mechanic_id = '{$id}' AND effective_date <= '$c_date' ORDER BY effective_date DESC, id DESC LIMIT 1");
    $rate_c = ($rate_c_qry->num_rows > 0) ? $rate_c_qry->fetch_assoc()['salary'] : $daily_salary;
    $filtered_salary += ($f_row['status'] == 3) ? ($rate_c / 2) : $rate_c;
}

$filtered_comm = $conn->query("SELECT SUM(mechanic_commission_amount) FROM transaction_list WHERE mechanic_id = '{$id}' AND date_created BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'")->fetch_array()[0] ?? 0;
$filtered_earned = $filtered_salary + $filtered_comm;
$filtered_paid = $conn->query("SELECT SUM(amount) FROM advance_payments WHERE mechanic_id = '{$id}' AND date_paid BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;

// Calculate filtered balance
$filtered_balance = $filtered_earned - $filtered_paid;
?>

<div class="content">
    <div class="container-fluid py-3">
        
        <!-- Compact Header with Image -->
        <div class="row mb-3">
            <div class="col-md-12">
                <div class="card bg-dark-gray border-0">
                    <div class="card-body p-3">
                        <div class="row align-items-center">
                            <div class="col-auto">
                                <a href="./?page=mechanics" class="btn btn-outline-light btn-sm rounded-circle">
                                    <i class="fa fa-arrow-left"></i>
                                </a>
                            </div>
                            <div class="col-auto">
                                <div class="avatar-container">
                                    <img src="<?php echo $avatar_url ?>" alt="<?= isset($name) ? $name : 'Mechanic' ?>" class="avatar-img" onerror="this.src='<?php echo validate_image('uploads/avatars/default-avatar.jpg') ?>'">
                                </div>
                            </div>
                            <div class="col">
                                <div>
                                    <h4 class="text-light mb-0"><b><?= isset($name) ? $name : 'N/A' ?></b></h4>
                                    <div class="d-flex flex-wrap align-items-center mt-1">
                                        <span class="badge badge-<?= ($status == 1) ? 'success' : 'secondary' ?> badge-sm mr-2">
                                            <?= ($status == 1) ? 'Active' : 'Inactive' ?>
                                        </span>
                                        <?php if(isset($contact) && !empty($contact)): ?>
                                        <span class="text-muted small mr-3">
                                            <i class="fa fa-phone-alt mr-1"></i> <?= $contact ?>
                                        </span>
                                        <?php endif; ?>
                                        <?php if(isset($address) && !empty($address)): ?>
                                        <span class="text-muted small">
                                            <i class="fa fa-map-marker-alt mr-1"></i> <?= substr($address, 0, 30) ?>...
                                        </span>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>
                            <div class="col-auto">
                                <button class="btn btn-success btn-sm px-3" onclick="add_payment()">
                                    <i class="fa fa-plus mr-1"></i> Add Payment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick Actions -->
        <div class="row mb-3">
            <div class="col-md-12">
                <div class="card bg-dark-gray border-0">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center">
                                <span class="text-muted small mr-2">Period:</span>
                                <h6 class="mb-0 text-light">
                                    <i class="fa fa-calendar-alt text-primary mr-1"></i>
                                    <?= date("d M, Y", strtotime($from)) ?> - <?= date("d M, Y", strtotime($to)) ?>
                                </h6>
                            </div>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-light border-secondary" onclick="window.print()" title="Print">
                                    <i class="fa fa-print"></i>
                                </button>
                                <button class="btn btn-outline-light border-secondary ml-1" onclick="send_whatsapp()" title="WhatsApp">
                                    <i class="fab fa-whatsapp"></i>
                                </button>
                                <button class="btn btn-outline-light border-secondary ml-1" onclick="showFullReport()" title="Detailed Report">
                                    <i class="fa fa-chart-bar"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Enhanced Date Filter with Quick Buttons -->
        <div class="row mb-3">
            <div class="col-md-12">
                <div class="card bg-dark-gray border-0">
                    <div class="card-header bg-dark border-0 p-2">
                        <h6 class="mb-0 text-light"><i class="fa fa-filter mr-1"></i> Date Filter</h6>
                    </div>
                    <div class="card-body p-2">
                        <!-- Quick Date Buttons -->
                        <div class="row mb-2">
                            <div class="col-md-12">
                                <div class="btn-group btn-group-sm d-flex">
                                    <button type="button" class="btn btn-outline-secondary flex-fill" onclick="setDateRange('<?= $last_month_from ?>', '<?= $last_month_to ?>')">
                                        <i class="fa fa-chevron-left mr-1"></i> Last Month
                                    </button>
                                    <button type="button" class="btn btn-outline-primary flex-fill" onclick="setCurrentMonth()">
                                        This Month
                                    </button>
                                    <button type="button" class="btn btn-outline-secondary flex-fill" onclick="setDateRange('<?= $next_month_from ?>', '<?= $next_month_to ?>')">
                                        Next Month <i class="fa fa-chevron-right ml-1"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Date Inputs -->
                        <form id="filter-form" class="row align-items-center">
                            <input type="hidden" name="page" value="mechanics/view_mechanic">
                            <input type="hidden" name="id" value="<?= isset($_GET['id']) ? $_GET['id'] : '' ?>">
                            
                            <div class="col-md-4">
                                <div class="input-group input-group-sm">
                                    <div class="input-group-prepend">
                                        <span class="input-group-text bg-dark border-secondary text-light">From</span>
                                    </div>
                                    <input type="date" name="from" class="form-control bg-dark border-secondary text-light" value="<?= $from ?>">
                                </div>
                            </div>
                            
                            <div class="col-md-4">
                                <div class="input-group input-group-sm">
                                    <div class="input-group-prepend">
                                        <span class="input-group-text bg-dark border-secondary text-light">To</span>
                                    </div>
                                    <input type="date" name="to" class="form-control bg-dark border-secondary text-light" value="<?= $to ?>">
                                </div>
                            </div>
                            
                            <div class="col-md-4">
                                <div class="d-flex">
                                    <button class="btn btn-primary btn-sm mr-1 px-3 flex-fill">
                                        <i class="fa fa-filter mr-1"></i> Apply Filter
                                    </button>
                                    <button type="button" class="btn btn-secondary btn-sm" onclick="resetFilter()" title="Reset to Current Month">
                                        <i class="fa fa-redo"></i>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- Statistics Cards -->
        <div class="row mb-3">
            <!-- Total Earned -->
            <div class="col-md-3">
                <div class="card bg-dark-card border-0 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted d-block">TOTAL EARNED</small>
                                <h4 class="mb-0 text-primary">₹ <?= number_format($filtered_earned, 2) ?></h4>
                                <div class="mt-2">
                                    <small class="text-muted d-block">
                                        <i class="fa fa-money-bill-wave mr-1"></i> Salary: ₹<?= number_format($filtered_salary, 2) ?>
                                    </small>
                                    <small class="text-muted d-block">
                                        <i class="fa fa-percentage mr-1"></i> Commission: ₹<?= number_format($filtered_comm, 2) ?>
                                    </small>
                                </div>
                            </div>
                            <div class="icon-circle bg-primary-soft">
                                <i class="fa fa-wallet text-primary"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Total Advance -->
            <div class="col-md-3">
                <div class="card bg-dark-card border-0 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted d-block">TOTAL ADVANCE</small>
                                <h4 class="mb-0 text-danger">₹ <?= number_format($filtered_paid, 2) ?></h4>
                                <div class="mt-2">
                                    <small class="text-muted">
                                        <i class="fa fa-calendar mr-1"></i> <?= date("M Y", strtotime($from)) ?>
                                    </small>
                                </div>
                            </div>
                            <div class="icon-circle bg-danger-soft">
                                <i class="fa fa-hand-holding-usd text-danger"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Period Balance -->
            <div class="col-md-3">
                <div class="card bg-dark-card border-0 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted d-block">PERIOD BALANCE</small>
                                <h4 class="mb-0 text-warning">₹ <?= number_format($filtered_balance, 2) ?></h4>
                                <div class="mt-2">
                                    <small class="text-muted">
                                        <?php if($filtered_balance > 0): ?>
                                            <i class="fa fa-arrow-up text-success mr-1"></i> Payable to Staff
                                        <?php elseif($filtered_balance < 0): ?>
                                            <i class="fa fa-arrow-down text-danger mr-1"></i> Advance Taken
                                        <?php else: ?>
                                            <i class="fa fa-check text-success mr-1"></i> Settled
                                        <?php endif; ?>
                                    </small>
                                </div>
                            </div>
                            <div class="icon-circle bg-warning-soft">
                                <i class="fa fa-balance-scale text-warning"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Overall Net Payable -->
            <div class="col-md-3">
                <div class="card bg-dark-card border-0 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted d-block">OVERALL BALANCE</small>
                                <h4 class="mb-0 text-success">₹ <?= number_format($net_payable_overall, 2) ?></h4>
                                <div class="mt-2">
                                    <small class="text-muted">
                                        <i class="fa fa-history mr-1"></i> Lifetime Pending
                                    </small>
                                </div>
                            </div>
                            <div class="icon-circle bg-success-soft">
                                <i class="fa fa-money-check-alt text-success"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Summary Bar -->
        <div class="row mb-3">
            <div class="col-md-12">
                <div class="card bg-dark-card border-0">
                    <div class="card-body p-3">
                        <div class="row text-center">
                            <div class="col-md-3 border-right border-secondary">
                                <h6 class="text-muted mb-1">Total Jobs</h6>
                                <h4 class="text-primary mb-0">
                                    <?php 
                                    $job_count = $conn->query("SELECT COUNT(*) FROM transaction_list WHERE mechanic_id = '{$id}' AND status = 5 AND date_updated BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
                                    echo $job_count;
                                    ?>
                                </h4>
                            </div>
                            <div class="col-md-3 border-right border-secondary">
                                <h6 class="text-muted mb-1">Avg. Commission</h6>
                                <h4 class="text-warning mb-0">
                                    ₹ <?= ($job_count > 0) ? number_format($filtered_comm / $job_count, 2) : '0.00' ?>
                                </h4>
                            </div>
                            <div class="col-md-3 border-right border-secondary">
                                <h6 class="text-muted mb-1">Working Days</h6>
                                <h4 class="text-info mb-0">
                                    <?php 
                                    $days_count = $conn->query("SELECT COUNT(DISTINCT curr_date) FROM attendance_list WHERE mechanic_id = '{$id}' AND status IN (1,3) AND curr_date BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
                                    echo $days_count;
                                    ?>
                                </h4>
                            </div>
                            <div class="col-md-3">
                                <h6 class="text-muted mb-1">Avg. Daily Earn</h6>
                                <h4 class="text-success mb-0">
                                    ₹ <?= ($days_count > 0) ? number_format($filtered_earned / $days_count, 2) : '0.00' ?>
                                </h4>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content Tabs -->
        <div class="row">
            <div class="col-md-12">
                <div class="card bg-dark-card border-0">
                    <div class="card-header bg-dark border-0 p-0">
                        <ul class="nav nav-tabs nav-justified border-0" id="custom-tabs" role="tablist">
                            <li class="nav-item">
                                <a class="nav-link active py-2" data-toggle="pill" href="#work">
                                    <i class="fa fa-tools mr-1"></i> Work History
                                    <span class="badge badge-primary ml-1"><?= $job_count ?></span>
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link py-2" data-toggle="pill" href="#ledger">
                                    <i class="fa fa-file-invoice-dollar mr-1"></i> Payment Ledger
                                    <span class="badge badge-danger ml-1">
                                        <?php 
                                        $pay_count = $conn->query("SELECT COUNT(*) FROM advance_payments WHERE mechanic_id = '{$id}' AND date_paid BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
                                        echo $pay_count;
                                        ?>
                                    </span>
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link py-2" data-toggle="pill" href="#attendance">
                                    <i class="fa fa-calendar-check mr-1"></i> Attendance
                                    <span class="badge badge-info ml-1"><?= $days_count ?></span>
                                </a>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="card-body p-0">
                        <div class="tab-content">
                            <!-- Work History Tab -->
                            <div class="tab-pane fade show active p-3" id="work">
                                <div class="table-responsive">
                                    <table class="table table-hover table-dark" id="work-table">
                                        <thead class="bg-primary">
                                            <tr>
                                                <th class="py-2"><i class="fa fa-calendar mr-1"></i> Date</th>
                                                <th class="py-2">Job ID</th>
                                                <th class="py-2">Item/Service</th>
                                                <th class="py-2">Commission</th>
                                                <th class="py-2">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            $jobs = $conn->query("SELECT * FROM transaction_list WHERE mechanic_id = '{$id}' AND status = 5 AND date_updated BETWEEN '{$from}' AND '{$to}' ORDER BY date_updated DESC");
                                            while($row = $jobs->fetch_assoc()):
                                            ?>
                                            <tr>
                                                <td class="py-2">
                                                    <small><?= date("d M, Y", strtotime($row['date_updated'])) ?></small>
                                                </td>
                                                <td class="py-2">
                                                    <a href="./?page=transactions/view_details&id=<?= $row['id'] ?>" class="text-primary">
                                                        <?= $row['job_id'] ?>
                                                    </a>
                                                </td>
                                                <td class="py-2">
                                                    <small><?= htmlspecialchars($row['item']) ?></small>
                                                </td>
                                                <td class="py-2">
                                                    <span class="badge badge-success">
                                                        ₹<?= number_format($row['mechanic_commission_amount'], 2) ?>
                                                    </span>
                                                </td>
                                                <td class="py-2">
                                                    <span class="badge badge-success">
                                                        <i class="fa fa-check"></i> Completed
                                                    </span>
                                                </td>
                                            </tr>
                                            <?php endwhile; ?>
                                            <?php if($job_count == 0): ?>
                                            <tr>
                                                <td colspan="5" class="text-center py-4">
                                                    <div class="text-muted">
                                                        <i class="fa fa-tools fa-2x mb-2"></i>
                                                        <p>No work history found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                            <?php endif; ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Payment Ledger Tab -->
                            <div class="tab-pane fade p-3" id="ledger">
                                <div class="table-responsive">
                                    <table class="table table-hover table-dark" id="ledger-table">
                                        <thead class="bg-danger">
                                            <tr>
                                                <th class="py-2"><i class="fa fa-calendar mr-1"></i> Date</th>
                                                <th class="py-2">Note</th>
                                                <th class="py-2">Amount</th>
                                                <th class="py-2">Type</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            $pays = $conn->query("SELECT * FROM advance_payments WHERE mechanic_id = '{$id}' AND date_paid BETWEEN '{$from}' AND '{$to}' ORDER BY date_paid DESC");
                                            while($prow = $pays->fetch_assoc()):
                                            ?>
                                            <tr>
                                                <td class="py-2">
                                                    <small><?= date("d M, Y", strtotime($prow['date_paid'])) ?></small>
                                                </td>
                                                <td class="py-2">
                                                    <small><?= htmlspecialchars($prow['reason']) ?></small>
                                                </td>
                                                <td class="py-2">
                                                    <span class="badge badge-danger">
                                                        ₹<?= number_format($prow['amount'], 2) ?>
                                                    </span>
                                                </td>
                                                <td class="py-2">
                                                    <span class="badge badge-secondary">
                                                        Advance
                                                    </span>
                                                </td>
                                            </tr>
                                            <?php endwhile; ?>
                                            <?php if($pay_count == 0): ?>
                                            <tr>
                                                <td colspan="4" class="text-center py-4">
                                                    <div class="text-muted">
                                                        <i class="fa fa-money-bill-wave fa-2x mb-2"></i>
                                                        <p>No payments found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                            <?php endif; ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Attendance Tab -->
                            <div class="tab-pane fade p-3" id="attendance">
                                <div class="row mb-3">
                                    <div class="col-md-12">
                                        <div class="card bg-dark border-0">
                                            <div class="card-body p-3">
                                                <h6 class="mb-3 text-light"><i class="fa fa-chart-pie mr-1"></i> Attendance Summary</h6>
                                                <div class="row text-center">
                                                    <?php 
                                                    $full_days = $conn->query("SELECT COUNT(*) FROM attendance_list WHERE mechanic_id = '{$id}' AND status = 1 AND curr_date BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
                                                    $half_days = $conn->query("SELECT COUNT(*) FROM attendance_list WHERE mechanic_id = '{$id}' AND status = 3 AND curr_date BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
                                                    $absent_days = $conn->query("SELECT COUNT(*) FROM attendance_list WHERE mechanic_id = '{$id}' AND status = 2 AND curr_date BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
                                                    ?>
                                                    <div class="col-md-4">
                                                        <div class="p-3 bg-success-soft rounded">
                                                            <h4 class="mb-0 text-success"><?= $full_days ?></h4>
                                                            <small class="text-muted">Full Days</small>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-4">
                                                        <div class="p-3 bg-warning-soft rounded">
                                                            <h4 class="mb-0 text-warning"><?= $half_days ?></h4>
                                                            <small class="text-muted">Half Days</small>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-4">
                                                        <div class="p-3 bg-danger-soft rounded">
                                                            <h4 class="mb-0 text-danger"><?= $absent_days ?></h4>
                                                            <small class="text-muted">Absent Days</small>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="table-responsive">
                                    <table class="table table-hover table-dark" id="attendance-table">
                                        <thead class="bg-info">
                                            <tr>
                                                <th class="py-2">Date</th>
                                                <th class="py-2">Day</th>
                                                <th class="py-2">Status</th>
                                                <th class="py-2">Salary</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            $attendance = $conn->query("SELECT * FROM attendance_list WHERE mechanic_id = '{$id}' AND curr_date BETWEEN '{$from}' AND '{$to}' ORDER BY curr_date DESC");
                                            while($att = $attendance->fetch_assoc()):
                                                // Calculate salary for this day
                                                $att_date = $att['curr_date'];
                                                $rate_qry = $conn->query("SELECT salary FROM mechanic_salary_history WHERE mechanic_id = '{$id}' AND effective_date <= '$att_date' ORDER BY effective_date DESC, id DESC LIMIT 1");
                                                $day_rate = ($rate_qry->num_rows > 0) ? $rate_qry->fetch_assoc()['salary'] : $daily_salary;
                                                
                                                if($att['status'] == 1) {
                                                    $day_salary = $day_rate;
                                                    $status_class = 'success';
                                                    $status_text = 'Full Day';
                                                } elseif($att['status'] == 3) {
                                                    $day_salary = $day_rate / 2;
                                                    $status_class = 'warning';
                                                    $status_text = 'Half Day';
                                                } else {
                                                    $day_salary = 0;
                                                    $status_class = 'danger';
                                                    $status_text = 'Absent';
                                                }
                                            ?>
                                            <tr>
                                                <td class="py-2"><?= date("d M, Y", strtotime($att['curr_date'])) ?></td>
                                                <td class="py-2"><?= date("l", strtotime($att['curr_date'])) ?></td>
                                                <td class="py-2">
                                                    <span class="badge badge-<?= $status_class ?>">
                                                        <?= $status_text ?>
                                                    </span>
                                                </td>
                                                <td class="py-2 font-weight-bold <?= ($day_salary > 0) ? 'text-success' : 'text-muted' ?>">
                                                    ₹ <?= number_format($day_salary, 2) ?>
                                                </td>
                                            </tr>
                                            <?php endwhile; ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
function add_payment(){
    uni_modal("<i class='fa fa-plus'></i> New Payment for <?= isset($name) ? $name : '' ?>", "attendance/manage_advance.php?mechanic_id=<?= $id ?>");
}

function send_whatsapp(){
    var text = "*🚗 Mechanic Report: <?= isset($name) ? $name : '' ?>*%0A" +
               "📅 Period: <?= date('d M', strtotime($from)) ?> to <?= date('d M', strtotime($to)) ?>%0A" +
               "━━━━━━━━━━━━━━━━━━━━%0A" +
               "💰 *Earned in Period:* ₹<?= number_format($filtered_earned) ?>%0A" +
               "   ├─ Salary: ₹<?= number_format($filtered_salary) ?>%0A" +
               "   └─ Commission: ₹<?= number_format($filtered_comm) ?>%0A" +
               "💸 *Paid in Period:* ₹<?= number_format($filtered_paid) ?>%0A" +
               "━━━━━━━━━━━━━━━━━━━━%0A" +
               "⚖️ *Period Balance:* ₹<?= number_format($filtered_balance) ?>%0A" +
               "━━━━━━━━━━━━━━━━━━━━%0A" +
               "📊 *OVERALL PENDING:* ₹<?= number_format($net_payable_overall) ?>%0A" +
               "━━━━━━━━━━━━━━━━━━━━%0A" +
               "Generated on <?= date('d M Y, h:i A') ?>";
    
    var phone = "<?= isset($contact) ? $contact : '' ?>";
    if(phone) {
        window.open("https://wa.me/91" + phone + "?text=" + encodeURIComponent(text));
    } else {
        alert("Phone number not available for this staff member.");
    }
}

function showFullReport() {
    uni_modal("<i class='fa fa-chart-bar'></i> Detailed Report for <?= isset($name) ? $name : '' ?>", 
              "reports/mechanic_detailed.php?id=<?= $id ?>&from=<?= $from ?>&to=<?= $to ?>", "modal-lg");
}

function setCurrentMonth() {
    var today = new Date();
    var firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    var lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    $('input[name="from"]').val(formatDate(firstDay));
    $('input[name="to"]').val(formatDate(lastDay));
    $('#filter-form').submit();
}

function setDateRange(fromDate, toDate) {
    $('input[name="from"]').val(fromDate);
    $('input[name="to"]').val(toDate);
    $('#filter-form').submit();
}

function resetFilter() {
    location.href='./?page=mechanics/view_mechanic&id=<?= $_GET['id'] ?>';
}

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

$(function(){
    // Initialize DataTables
    $('#work-table').DataTable({
        "order": [[0, "desc"]],
        "pageLength": 10,
        "language": {
            "emptyTable": "No work history found",
            "info": "Showing _START_ to _END_ of _TOTAL_ jobs",
            "search": "Search jobs..."
        },
        "dom": '<"row"<"col-sm-6"l><"col-sm-6"f>><"row"<"col-sm-12"tr>><"row"<"col-sm-5"i><"col-sm-7"p>>'
    });
    
    $('#ledger-table').DataTable({
        "order": [[0, "desc"]],
        "pageLength": 10,
        "language": {
            "emptyTable": "No payment records found",
            "info": "Showing _START_ to _END_ of _TOTAL_ payments",
            "search": "Search payments..."
        },
        "dom": '<"row"<"col-sm-6"l><"col-sm-6"f>><"row"<"col-sm-12"tr>><"row"<"col-sm-5"i><"col-sm-7"p>>'
    });
    
    $('#attendance-table').DataTable({
        "order": [[0, "desc"]],
        "pageLength": 15,
        "language": {
            "emptyTable": "No attendance records found",
            "info": "Showing _START_ to _END_ of _TOTAL_ days",
            "search": "Search attendance..."
        },
        "dom": '<"row"<"col-sm-6"l><"col-sm-6"f>><"row"<"col-sm-12"tr>><"row"<"col-sm-5"i><"col-sm-7"p>>'
    });
    
    // Add active class to tabs
    $('.nav-tabs a').click(function(){
        $(this).tab('show');
    });
});
</script>

<style>
/* Refined Dark Theme with Better Contrast */
:root {
    --dark-bg: #121826;
    --dark-gray: #1e2536;
    --dark-card: #252d3d;
    --dark-border: #374151;
    --text-light: #f3f4f6;
    --text-muted: #9ca3af;
    --primary: #3b82f6;
    --secondary: #6b7280;
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
    --info: #0ea5e9;
}

body {
    background: var(--dark-bg);
    color: var(--text-light);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Card Styles */
.bg-dark-gray {
    background: var(--dark-gray) !important;
    border: 1px solid var(--dark-border) !important;
}

.bg-dark-card {
    background: var(--dark-card) !important;
    border: 1px solid var(--dark-border) !important;
}

.bg-dark {
    background: var(--dark-bg) !important;
}

/* Avatar Styles */
.avatar-container {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid var(--primary);
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
}

.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* Icon Circles */
.icon-circle {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

.bg-primary-soft { background: rgba(59, 130, 246, 0.15) !important; }
.bg-danger-soft { background: rgba(239, 68, 68, 0.15) !important; }
.bg-warning-soft { background: rgba(245, 158, 11, 0.15) !important; }
.bg-success-soft { background: rgba(16, 185, 129, 0.15) !important; }
.bg-info-soft { background: rgba(14, 165, 233, 0.15) !important; }

/* Table Styles */
.table-dark {
    background-color: transparent;
    color: var(--text-light);
    border-color: var(--dark-border);
}

.table-dark thead th {
    background-color: rgba(0,0,0,0.3);
    border-color: var(--dark-border);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
    padding: 12px;
}

.table-dark tbody td {
    border-color: var(--dark-border);
    padding: 12px;
    vertical-align: middle;
}

.table-dark tbody tr {
    transition: all 0.2s ease;
}

.table-dark tbody tr:hover {
    background-color: rgba(255,255,255,0.05);
    transform: translateX(2px);
}

/* Header Backgrounds */
.bg-primary { background: var(--primary) !important; }
.bg-danger { background: var(--danger) !important; }
.bg-info { background: var(--info) !important; }

/* Form Controls */
.form-control {
    background-color: rgba(255,255,255,0.05);
    border: 1px solid var(--dark-border);
    color: var(--text-light);
    border-radius: 6px;
    transition: all 0.2s;
}

.form-control:focus {
    background-color: rgba(255,255,255,0.08);
    border-color: var(--primary);
    color: var(--text-light);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.input-group-text {
    background-color: rgba(255,255,255,0.05);
    border: 1px solid var(--dark-border);
    color: var(--text-muted);
    border-right: none;
}

/* Button Styles */
.btn {
    border-radius: 6px;
    font-weight: 500;
    transition: all 0.2s;
}

.btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
}

.btn-outline-light {
    color: var(--text-muted);
    border-color: var(--dark-border);
    background: transparent;
}

.btn-outline-light:hover {
    background-color: rgba(255,255,255,0.1);
    border-color: var(--text-muted);
    color: var(--text-light);
}

.btn-outline-secondary {
    color: var(--text-muted);
    border-color: var(--dark-border);
    background: transparent;
}

.btn-outline-secondary:hover {
    background-color: rgba(255,255,255,0.05);
    border-color: var(--primary);
    color: var(--primary);
}

.btn-group-sm > .btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
}

/* Tab Styles */
.nav-tabs {
    border-bottom: 1px solid var(--dark-border);
    background: var(--dark-card);
}

.nav-tabs .nav-link {
    color: var(--text-muted);
    border: none;
    border-bottom: 3px solid transparent;
    padding: 1rem;
    font-weight: 500;
    transition: all 0.2s;
    position: relative;
}

.nav-tabs .nav-link:hover {
    color: var(--text-light);
    background: rgba(255,255,255,0.05);
    border-bottom-color: var(--dark-border);
}

.nav-tabs .nav-link.active {
    color: var(--primary);
    background: transparent;
    border-bottom: 3px solid var(--primary);
}

.nav-tabs .nav-link.active .badge {
    background: var(--primary) !important;
}

/* Badge Styles */
.badge {
    font-weight: 500;
    padding: 0.35em 0.65em;
    border-radius: 20px;
}

/* DataTable Customization */
.dataTables_wrapper {
    font-size: 0.95rem;
}

.dataTables_filter input {
    background-color: rgba(255,255,255,0.05) !important;
    border: 1px solid var(--dark-border) !important;
    color: var(--text-light) !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 6px !important;
    margin-left: 0.5rem !important;
}

.dataTables_length select {
    background-color: rgba(255,255,255,0.05) !important;
    border: 1px solid var(--dark-border) !important;
    color: var(--text-light) !important;
    padding: 0.375rem 1.75rem 0.375rem 0.75rem !important;
    border-radius: 6px !important;
}

.dataTables_info, .dataTables_paginate {
    color: var(--text-muted) !important;
    font-size: 0.875rem;
    padding-top: 1rem !important;
}

.page-link {
    background-color: rgba(255,255,255,0.05) !important;
    border: 1px solid var(--dark-border) !important;
    color: var(--text-muted) !important;
    margin: 0 2px;
    border-radius: 4px !important;
}

.page-link:hover {
    background-color: rgba(255,255,255,0.1) !important;
    border-color: var(--primary) !important;
    color: var(--text-light) !important;
}

.page-item.active .page-link {
    background-color: var(--primary) !important;
    border-color: var(--primary) !important;
    color: white !important;
}

/* Quick Date Buttons */
.btn-group .btn {
    margin: 0;
}

/* Border Utilities */
.border-secondary {
    border-color: var(--dark-border) !important;
}

/* =========================================== */
/* FIX FOR MODAL TEXT IN DARK THEME */
/* =========================================== */
.modal-content {
    background-color: #1e2536 !important;
    color: #f3f4f6 !important;
    border: 1px solid #374151 !important;
}

.modal-header {
    background-color: #252d3d !important;
    border-bottom: 1px solid #374151 !important;
    color: #f3f4f6 !important;
}

.modal-title {
    color: #f3f4f6 !important;
}

.modal-body {
    background-color: #1e2536 !important;
    color: #f3f4f6 !important;
}

.modal-body label {
    color: #d1d5db !important;
}

.modal-body .form-control {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border-color: #374151 !important;
    color: #f3f4f6 !important;
}

.modal-body .form-control:focus {
    background-color: rgba(255, 255, 255, 0.08) !important;
    border-color: #3b82f6 !important;
    color: #f3f4f6 !important;
}

.modal-body .input-group-text {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border-color: #374151 !important;
    color: #9ca3af !important;
}

.modal-footer {
    background-color: #252d3d !important;
    border-top: 1px solid #374151 !important;
}

.modal-body .text-muted {
    color: #9ca3af !important;
}

.modal-body .help-text {
    color: #9ca3af !important;
}

.modal-body small {
    color: #9ca3af !important;
}

/* Fix for select2 dropdown in modal */
.select2-container--default .select2-selection--single,
.select2-container--default .select2-selection--multiple {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border-color: #374151 !important;
    color: #f3f4f6 !important;
}

.select2-container--default .select2-selection--single .select2-selection__rendered {
    color: #f3f4f6 !important;
}

.select2-container--default .select2-results__option {
    background-color: #1e2536 !important;
    color: #f3f4f6 !important;
}

.select2-container--default .select2-results__option--highlighted[aria-selected] {
    background-color: #3b82f6 !important;
    color: white !important;
}

.select2-dropdown {
    background-color: #1e2536 !important;
    border-color: #374151 !important;
}

/* Fix for radio and checkbox labels */
.modal-body .form-check-label {
    color: #d1d5db !important;
}

/* Fix for alert messages in modal */
.modal-body .alert {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border-color: #374151 !important;
    color: #f3f4f6 !important;
}

/* Responsive */
@media (max-width: 768px) {
    .avatar-container {
        width: 50px;
        height: 50px;
    }
    
    .nav-tabs .nav-link {
        padding: 0.75rem 0.5rem;
        font-size: 0.85rem;
    }
    
    .icon-circle {
        width: 40px;
        height: 40px;
        font-size: 16px;
    }
    
    .btn-group-sm > .btn {
        font-size: 0.8rem;
        padding: 0.2rem 0.4rem;
    }
}

/* Print Styles */
@media print {
    body {
        background: white !important;
        color: black !important;
    }
    
    .card {
        background: white !important;
        border: 1px solid #ddd !important;
    }
    
    .table-dark {
        color: black !important;
    }
}
</style>