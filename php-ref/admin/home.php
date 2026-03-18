<?php
// home.php – Modern, Informative Dashboard for V-Technologies
// Designed with real‑time stats, financial overview, charts, and recent activity tables.

// Get date range from GET or default to current month
$from = isset($_GET['from']) ? $_GET['from'] : date('Y-m-01');
$to   = isset($_GET['to'])   ? $_GET['to']   : date('Y-m-t');
?>

<!-- ===== WELCOME HEADER ===== -->
<h1 class="text-primary font-weight-bold mb-4">
    <i class="fa fa-tachometer-alt mr-2"></i>
    Welcome back, <?php echo $_settings->userdata('firstname') . ' ' . $_settings->userdata('lastname'); ?>!
</h1>
<hr class="border-primary mb-4">

<!-- ===== FILTER FORM (Date Range) ===== -->
<div class="card shadow-sm border-0 rounded-lg mb-4">
    <div class="card-body">
        <form id="filter-form" method="GET" class="form-inline justify-content-end">
            <input type="hidden" name="p" value="home">
            <label class="mr-2 font-weight-bold">From:</label>
            <input type="date" name="from" value="<?= $from ?>" class="form-control mr-3 mb-2 mb-sm-0" required>
            <label class="mr-2 font-weight-bold">To:</label>
            <input type="date" name="to" value="<?= $to ?>" class="form-control mr-3 mb-2 mb-sm-0" required>
            <button type="submit" class="btn btn-primary mr-2"><i class="fa fa-filter"></i> Apply</button>
            <a href="?p=home" class="btn btn-outline-secondary"><i class="fa fa-redo"></i> Reset</a>
        </form>
    </div>
</div>

<!-- ===== MAIN STATISTICS CARDS (Visible to all users) ===== -->
<div class="row">
    <!-- Total Clients -->
    <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
        <a href="./?page=clients" class="text-decoration-none">
            <div class="card stat-card bg-gradient-cyan text-white h-100 border-0 shadow-lg">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-uppercase small font-weight-bold">Total Clients</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?= number_format($conn->query("SELECT COUNT(*) FROM client_list WHERE delete_flag = 0")->fetch_row()[0]) ?>
                            </h2>
                        </div>
                        <i class="fas fa-users fa-3x opacity-50"></i>
                    </div>
                </div>
            </div>
        </a>
    </div>

    <!-- Pending Jobs (status 0) -->
    <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
        <a href="./?page=transactions&status=0" class="text-decoration-none">
            <div class="card stat-card bg-gradient-orange text-white h-100 border-0 shadow-lg">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-uppercase small font-weight-bold">Pending</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?= number_format($conn->query("SELECT COUNT(*) FROM transaction_list WHERE status = 0")->fetch_row()[0]) ?>
                            </h2>
                        </div>
                        <i class="fas fa-clock fa-3x opacity-50"></i>
                    </div>
                </div>
            </div>
        </a>
    </div>

    <!-- In Progress (status 1) -->
    <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
        <a href="./?page=transactions&status=1" class="text-decoration-none">
            <div class="card stat-card bg-gradient-blue text-white h-100 border-0 shadow-lg">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-uppercase small font-weight-bold">In Progress</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?= number_format($conn->query("SELECT COUNT(*) FROM transaction_list WHERE status = 1")->fetch_row()[0]) ?>
                            </h2>
                        </div>
                        <i class="fas fa-spinner fa-spin fa-3x opacity-50"></i>
                    </div>
                </div>
            </div>
        </a>
    </div>

    <!-- Finished (status 2) -->
    <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
        <a href="./?page=transactions&status=2" class="text-decoration-none">
            <div class="card stat-card bg-gradient-green text-white h-100 border-0 shadow-lg">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-uppercase small font-weight-bold">Finished</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?= number_format($conn->query("SELECT COUNT(*) FROM transaction_list WHERE status = 2")->fetch_row()[0]) ?>
                            </h2>
                        </div>
                        <i class="fas fa-check-circle fa-3x opacity-50"></i>
                    </div>
                </div>
            </div>
        </a>
    </div>

    <!-- Delivered (status 5) -->
    <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
        <a href="./?page=transactions&status=5" class="text-decoration-none">
            <div class="card stat-card bg-gradient-purple text-white h-100 border-0 shadow-lg">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-uppercase small font-weight-bold">Delivered</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?= number_format($conn->query("SELECT COUNT(*) FROM transaction_list WHERE status = 5")->fetch_row()[0]) ?>
                            </h2>
                        </div>
                        <i class="fas fa-truck fa-3x opacity-50"></i>
                    </div>
                </div>
            </div>
        </a>
    </div>

    <!-- Total Mechanics (active) -->
    <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
        <a href="./?page=transactions" class="text-decoration-none">
            <div class="card stat-card bg-gradient-pink text-white h-100 border-0 shadow-lg">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-uppercase small font-weight-bold">Total Jobs</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?= number_format($conn->query("SELECT COUNT(*) FROM transaction_list")->fetch_row()[0]) ?>
                            </h2>
                        </div>
                        <i class="fas fa-clipboard-list fa-3x opacity-50"></i>
                    </div>
                </div>
            </div>
        </a>
    </div>
	
	<!-- Total Mechanics (active) 
    <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
        <a href="./?page=mechanics" class="text-decoration-none">
            <div class="card stat-card bg-gradient-pink text-white h-100 border-0 shadow-lg">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-uppercase small font-weight-bold">Mechanics</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?= number_format($conn->query("SELECT COUNT(*) FROM mechanic_list WHERE delete_flag = 0")->fetch_row()[0]) ?>
                            </h2>
                        </div>
                        <i class="fas fa-user-cog fa-3x opacity-50"></i>
                    </div>
                </div>
            </div>
        </a>
    </div> -->

    <!-- Low Stock Alert -->
    <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
        <a href="./?page=inventory" class="text-decoration-none">
            <div class="card stat-card bg-gradient-red text-white h-100 border-0 shadow-lg">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-uppercase small font-weight-bold">Low Stock</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?php
                                $lowStock = $conn->query("SELECT COUNT(DISTINCT product_id) FROM inventory_list WHERE quantity <= 5")->fetch_row()[0];
                                echo number_format($lowStock);
                                ?>
                            </h2>
                        </div>
                        <i class="fas fa-exclamation-triangle fa-3x opacity-50"></i>
                    </div>
                </div>
            </div>
        </a>
    </div>

    <!-- Today's Revenue -->
    <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
        <div class="card stat-card bg-gradient-indigo text-white h-100 border-0 shadow-lg">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="text-uppercase small font-weight-bold">Today's Revenue</h6>
                        <h2 class="font-weight-bold mb-0">
                            ₹<?php
                            $today = date('Y-m-d');
                            $jobRev = $conn->query("SELECT SUM(amount) FROM transaction_list WHERE status = 5 AND DATE(date_completed) = '$today'")->fetch_row()[0];
                            $directRev = $conn->query("SELECT SUM(total_amount) FROM direct_sales WHERE DATE(date_created) = '$today'")->fetch_row()[0];
                            echo number_format(($jobRev ?? 0) + ($directRev ?? 0), 2);
                            ?>
                        </h2>
                    </div>
                    <i class="fas fa-rupee-sign fa-3x opacity-50"></i>
                </div>
            </div>
        </div>
    </div>
</div>

<?php if ($_settings->userdata('type') == 1): // ========== ADMIN SECTION ========== ?>
<!-- ===== FINANCIAL OVERVIEW (Admin only) ===== -->
<div class="row mt-3">
    <div class="col-12">
        <div class="card shadow-sm border-0 rounded-lg">
            <div class="card-header bg-white border-0">
                <h5 class="mb-0 font-weight-bold text-primary"><i class="fas fa-chart-line mr-2"></i>Financial Summary (<?= date('d M Y', strtotime($from)) ?> - <?= date('d M Y', strtotime($to)) ?>)</h5>
            </div>
            <div class="card-body">
                <?php
                // --- Fetch data for the selected period ---
                $repairInc = $conn->query("SELECT SUM(amount) FROM transaction_list WHERE status = 5 AND DATE(date_completed) BETWEEN '$from' AND '$to'")->fetch_row()[0] ?? 0;
                $directInc = $conn->query("SELECT SUM(total_amount) FROM direct_sales WHERE DATE(date_created) BETWEEN '$from' AND '$to'")->fetch_row()[0] ?? 0;
                $totalSales = $repairInc + $directInc;

                $partsTrans = $conn->query("SELECT SUM(tp.price * tp.qty) FROM transaction_products tp INNER JOIN transaction_list t ON tp.transaction_id = t.id WHERE t.status = 5 AND DATE(t.date_completed) BETWEEN '$from' AND '$to'")->fetch_row()[0] ?? 0;
                $partsDirect = $conn->query("SELECT SUM(ds.price * ds.qty) FROM direct_sale_items ds INNER JOIN direct_sales d ON ds.sale_id = d.id WHERE DATE(d.date_created) BETWEEN '$from' AND '$to'")->fetch_row()[0] ?? 0;
                $totalPartsSold = $partsTrans + $partsDirect;
                $partsCost = $totalPartsSold * 0.90;

                $grossProfit = $totalSales - $partsCost;

                $discounts = $conn->query("SELECT SUM(discount) FROM client_payments WHERE DATE(created_at) BETWEEN '$from' AND '$to'")->fetch_row()[0] ?? 0;

                $salary = $conn->query("SELECT SUM(CASE WHEN a.status = 1 THEN m.daily_salary WHEN a.status = 3 THEN m.daily_salary/2 ELSE 0 END) FROM attendance_list a INNER JOIN mechanic_list m ON a.mechanic_id = m.id WHERE a.curr_date BETWEEN '$from' AND '$to'")->fetch_row()[0] ?? 0;

                $loanPaid = $conn->query("SELECT SUM(amount_paid) FROM loan_payments WHERE DATE(payment_date) BETWEEN '$from' AND '$to'")->fetch_row()[0] ?? 0;

                $expenses = $conn->query("SELECT SUM(amount) FROM expense_list WHERE DATE(date_created) BETWEEN '$from' AND '$to'")->fetch_row()[0] ?? 0;

                $totalOutflow = $discounts + $salary + $loanPaid + $expenses;

                $netProfit = $grossProfit - $totalOutflow;
                ?>
                <div class="row">
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="info-box bg-light border-0 shadow-sm">
                            <span class="info-box-icon bg-info"><i class="fas fa-file-invoice-dollar"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Total Sales</span>
                                <span class="info-box-number font-weight-bold">₹<?= number_format($totalSales, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <!-- baaki info-box same rahe -->
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="info-box bg-light border-0 shadow-sm">
                            <span class="info-box-icon bg-warning"><i class="fas fa-cogs"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Est. Parts Cost (90%)</span>
                                <span class="info-box-number font-weight-bold">₹<?= number_format($partsCost, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="info-box bg-light border-0 shadow-sm">
                            <span class="info-box-icon bg-primary"><i class="fas fa-chart-pie"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Gross Profit</span>
                                <span class="info-box-number font-weight-bold">₹<?= number_format($grossProfit, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="info-box bg-light border-0 shadow-sm">
                            <span class="info-box-icon bg-danger"><i class="fas fa-tags"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Discounts</span>
                                <span class="info-box-number font-weight-bold">₹<?= number_format($discounts, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="info-box bg-light border-0 shadow-sm">
                            <span class="info-box-icon bg-secondary"><i class="fas fa-user-cog"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Staff Salary</span>
                                <span class="info-box-number font-weight-bold">₹<?= number_format($salary, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="info-box bg-light border-0 shadow-sm">
                            <span class="info-box-icon bg-navy"><i class="fas fa-hand-holding-usd"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Loan Repaid</span>
                                <span class="info-box-number font-weight-bold">₹<?= number_format($loanPaid, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="info-box bg-light border-0 shadow-sm">
                            <span class="info-box-icon bg-maroon"><i class="fas fa-wallet"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Other Expenses</span>
                                <span class="info-box-number font-weight-bold">₹<?= number_format($expenses, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="info-box bg-light border-0 shadow-sm">
                            <span class="info-box-icon bg-success"><i class="fas fa-chart-line"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Net Profit</span>
                                <span class="info-box-number font-weight-bold text-success">₹<?= number_format($netProfit, 2) ?></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- ===== CHARTS ROW ===== -->
<div class="row mt-4">
    <!-- Monthly Revenue Trend -->
    <div class="col-lg-8 mb-4">
        <div class="card shadow-sm border-0 rounded-lg h-100">
            <div class="card-header bg-white border-0">
                <h5 class="mb-0 font-weight-bold text-primary"><i class="fas fa-calendar-alt mr-2"></i>Monthly Revenue (Last 12 Months)</h5>
            </div>
            <div class="card-body chart-container">
                <canvas id="revenueChart"></canvas>
            </div>
        </div>
    </div>
    <!-- Job Status Distribution -->
    <div class="col-lg-4 mb-4">
        <div class="card shadow-sm border-0 rounded-lg h-100">
            <div class="card-header bg-white border-0">
                <h5 class="mb-0 font-weight-bold text-primary"><i class="fas fa-chart-pie mr-2"></i>Job Status</h5>
            </div>
            <div class="card-body chart-container">
                <canvas id="statusChart"></canvas>
            </div>
        </div>
    </div>
</div>

<?php
// --- Data for Monthly Revenue Chart (Last 12 Months) ---
$monthlyLabels = [];
$monthlyData = [];
for ($i = 11; $i >= 0; $i--) {
    $month = date('Y-m', strtotime("-$i months"));
    $start = $month . '-01';
    $end = date('Y-m-t', strtotime($start));
    $monthlyLabels[] = date('M Y', strtotime($start));

    $rep = $conn->query("SELECT COALESCE(SUM(amount),0) FROM transaction_list 
                         WHERE status = 5 AND DATE(date_completed) BETWEEN '$start' AND '$end'")->fetch_row()[0];

    $dir = $conn->query("SELECT COALESCE(SUM(total_amount),0) FROM direct_sales 
                         WHERE DATE(date_created) BETWEEN '$start' AND '$end'")->fetch_row()[0];

    $monthlyData[] = $rep + $dir;
}

// --- Data for Job Status Pie ---
$statuses = [0,1,2,3,4,5];
$statusLabels = ['Pending','In Progress','Finished','Paid','Cancelled','Delivered'];
$statusCounts = [];
foreach ($statuses as $s) {
    $statusCounts[] = $conn->query("SELECT COUNT(*) FROM transaction_list WHERE status = $s")->fetch_row()[0];
}
?>

<!-- ===== RECENT ACTIVITY TABLES ===== -->
<!-- (Yeh section bilkul same rakha gaya hai – koi change nahi) -->
<div class="row mt-4">
    <!-- Recent Jobs -->
    <div class="col-lg-6 mb-4">
        <div class="card shadow-sm border-0 rounded-lg h-100">
            <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <h5 class="mb-0 font-weight-bold text-primary"><i class="fas fa-tasks mr-2"></i>Recent Jobs</h5>
                <a href="./?page=transactions" class="btn btn-sm btn-outline-primary">View All</a>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead class="bg-light">
                            <tr>
                                <th>Job ID</th>
                                <th>Client</th>
                                <th>Item</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php
                            $recent = $conn->query("SELECT t.id, t.job_id, c.firstname, c.lastname, t.item, t.amount, t.status 
                                                    FROM transaction_list t 
                                                    LEFT JOIN client_list c ON t.client_name = c.id 
                                                    ORDER BY t.id DESC LIMIT 5");
                            while($row = $recent->fetch_assoc()):
                                $clientName = $row['firstname'] ? $row['firstname'].' '.$row['lastname'] : 'Walk-in';
                                $statusBadge = ['badge-secondary','badge-warning','badge-info','badge-success','badge-danger','badge-primary'][$row['status']];
                                $statusText = ['Pending','In Progress','Finished','Paid','Cancelled','Delivered'][$row['status']];
                            ?>
                            <tr>
                                <td><a href="./?page=view_transaction&id=<?= $row['id'] ?>"><?= $row['job_id'] ?></a></td>
                                <td><?= $clientName ?></td>
                                <td><?= substr($row['item'],0,20) ?>..</td>
                                <td>₹<?= number_format($row['amount'],2) ?></td>
                                <td><span class="badge <?= $statusBadge ?>"><?= $statusText ?></span></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Recent Payments -->
    <div class="col-lg-6 mb-4">
        <div class="card shadow-sm border-0 rounded-lg h-100">
            <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <h5 class="mb-0 font-weight-bold text-primary"><i class="fas fa-credit-card mr-2"></i>Recent Payments</h5>
                <a href="./?page=payments" class="btn btn-sm btn-outline-primary">View All</a>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead class="bg-light">
                            <tr>
                                <th>Client</th>
                                <th>Amount</th>
                                <th>Mode</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php
                            $payments = $conn->query("SELECT p.*, c.firstname, c.lastname 
                          FROM client_payments p 
                          LEFT JOIN client_list c ON p.client_id = c.id 
                          ORDER BY p.payment_date DESC, p.id DESC 
                          LIMIT 10");
                            while($row = $payments->fetch_assoc()):
                                $client = $row['firstname'] ? $row['firstname'].' '.$row['lastname'] : 'Unknown';
                            ?>
                            <tr>
                                <td><?= $client ?></td>
                                <td>₹<?= number_format($row['amount'],2) ?></td>
                                <td><?= $row['payment_mode'] ?></td>
                                <td><?= date('d M', strtotime($row['payment_date'])) ?></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Low Stock Items Table -->
<div class="row mt-2">
    <div class="col-12">
        <div class="card shadow-sm border-0 rounded-lg">
            <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <h5 class="mb-0 font-weight-bold text-primary"><i class="fas fa-exclamation-circle mr-2"></i>Low Stock Items (≤5)</h5>
                <a href="./?page=inventory" class="btn btn-sm btn-outline-primary">Manage Stock</a>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead class="bg-light">
                            <tr>
                                <th>Product</th>
                                <th>Quantity</th>
                                <th>Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php
                            $low = $conn->query("SELECT p.name, i.quantity, i.place 
                                                 FROM inventory_list i 
                                                 INNER JOIN product_list p ON i.product_id = p.id 
                                                 WHERE i.quantity <= 5 
                                                 ORDER BY i.quantity ASC LIMIT 10");
                            while($row = $low->fetch_assoc()):
                            ?>
                            <tr>
                                <td><?= $row['name'] ?></td>
                                <td><span class="badge badge-danger"><?= $row['quantity'] ?></span></td>
                                <td><?= $row['place'] ?: '—' ?></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<?php endif; // End admin section ?>

<!-- ===== BANNER CAROUSEL (Always visible) ===== -->
<div class="card shadow-lg rounded-lg mt-5 border-0 overflow-hidden">
    <div class="card-body p-0">
        <?php
        $files = glob(base_app.'uploads/banner/*.{jpg,jpeg,png,gif}', GLOB_BRACE);
        if (count($files) > 0):
        ?>
        <div id="dashboardCarousel" class="carousel slide" data-ride="carousel" data-interval="4000">
            <div class="carousel-inner">
                <?php foreach ($files as $k => $file): ?>
                <div class="carousel-item <?= $k == 0 ? 'active' : '' ?>">
                    <img class="d-block w-100" src="<?= validate_image(str_replace(base_app,'',$file)) ?>" alt="Banner" style="max-height: 400px; object-fit: cover;">
                </div>
                <?php endforeach; ?>
            </div>
            <a class="carousel-control-prev" href="#dashboardCarousel" role="button" data-slide="prev">
                <span class="carousel-control-prev-icon bg-dark rounded-circle" aria-hidden="true"></span>
            </a>
            <a class="carousel-control-next" href="#dashboardCarousel" role="button" data-slide="next">
                <span class="carousel-control-next-icon bg-dark rounded-circle" aria-hidden="true"></span>
            </a>
        </div>
        <?php else: ?>
        <div class="text-center py-5 bg-light">
            <i class="fa fa-image fa-5x text-muted mb-3"></i>
            <h5 class="text-muted">No banners uploaded yet</h5>
        </div>
        <?php endif; ?>
    </div>
</div>

<!-- ===== CHARTS INITIALIZATION ===== -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
<script>
$(function() {
    // Monthly Revenue Chart (Bar Chart)
    var ctx1 = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctx1, {
        type: 'line',
        data: {
            labels: <?= json_encode($monthlyLabels) ?>,
            datasets: [{
                label: 'Revenue (₹)',
                data: <?= json_encode($monthlyData) ?>,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,          // ← Yeh fix karta hai stretching
            aspectRatio: 2.2,                   // ← desirable width:height ratio (adjust if needed)
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { return '₹' + value; }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '₹' + context.raw.toFixed(2);
                        }
                    }
                }
            }
        }
    });

    // Job Status Pie Chart
    var ctx2 = document.getElementById('statusChart').getContext('2d');
    new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: <?= json_encode($statusLabels) ?>,
            datasets: [{
                data: <?= json_encode($statusCounts) ?>,
                backgroundColor: [
                    '#6c757d', '#ffc107', '#17a2b8', '#28a745', '#dc3545', '#007bff'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
});
</script>

<!-- ===== CUSTOM STYLES (updated) ===== -->
<style>
    .stat-card {
        border-radius: 20px !important;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .stat-card:hover {
        transform: translateY(-8px);
        box-shadow: 0 20px 30px rgba(0,0,0,0.2) !important;
    }
    .opacity-50 { opacity: 0.5; }
    .bg-gradient-cyan { background: linear-gradient(135deg, #17a2b8, #20c997); }
    .bg-gradient-orange { background: linear-gradient(135deg, #fd7e14, #ffc107); }
    .bg-gradient-blue { background: linear-gradient(135deg, #007bff, #6610f2); }
    .bg-gradient-green { background: linear-gradient(135deg, #28a745, #20c997); }
    .bg-gradient-purple { background: linear-gradient(135deg, #6f42c1, #e83e8c); }
    .bg-gradient-pink { background: linear-gradient(135deg, #e83e8c, #dc3545); }
    .bg-gradient-red { background: linear-gradient(135deg, #dc3545, #fd7e14); }
    .bg-gradient-indigo { background: linear-gradient(135deg, #6610f2, #6f42c1); }

    /* Chart container fix */
    .chart-container {
        position: relative;
        height: 320px;      /* important – prevents collapse/stretch */
        width: 100%;
    }

    .info-box-icon {
        width: 60px;
        height: 60px;
        border-radius: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
    }
    .info-box { border-radius: 15px; }
    .table th, .table td { vertical-align: middle; }
    .carousel-control-prev-icon, .carousel-control-next-icon {
        width: 40px;
        height: 40px;
        background-size: 60%;
    }
</style>