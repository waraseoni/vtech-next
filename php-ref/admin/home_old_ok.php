<h1 class="text-navy font-weight-bold mb-4">
    <i class="fa fa-home mr-2"></i>Welcome, <?php echo $_settings->userdata('firstname')." ".$_settings->userdata('lastname') ?>!
</h1>
<hr class="border-primary mb-5">

<!-- Main Dashboard Cards -->
<div class="row">
    <!-- Client List -->
    <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
        <a href="./?page=clients" class="text-decoration-none">
            <div class="card bg-gradient-teal-to-cyan shadow-lg h-100 hover-lift border-0 text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="opacity-80 text-uppercase small font-weight-bold">Client List</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?php 
                                $total = $conn->query("SELECT * FROM client_list WHERE delete_flag = 0")->num_rows;
                                echo number_format($total);
                                ?>
                            </h2>
                        </div>
                        <div class="icon-solid bg-teal">
                            <i class="fas fa-users fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    </div>

    <!-- Pending -->
    <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
        <a href="./?page=transactions&status=0" class="text-decoration-none">
            <div class="card bg-gradient-orange-to-red shadow-lg h-100 hover-lift border-0 text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="opacity-80 text-uppercase small font-weight-bold">Pending</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?php 
                                $total = $conn->query("SELECT * FROM transaction_list WHERE `status` = 0")->num_rows;
                                echo number_format($total);
                                ?>
                            </h2>
                        </div>
                        <div class="icon-solid bg-orange">
                            <i class="fas fa-clock fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    </div>

    <!-- On-Progress -->
    <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
        <a href="./?page=transactions&status=1" class="text-decoration-none">
            <div class="card bg-gradient-blue-to-indigo shadow-lg h-100 hover-lift border-0 text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="opacity-80 text-uppercase small font-weight-bold">On-Progress</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?php 
                                $total = $conn->query("SELECT * FROM transaction_list WHERE `status` = 1")->num_rows;
                                echo number_format($total);
                                ?>
                            </h2>
                        </div>
                        <div class="icon-solid bg-blue">
                            <i class="fas fa-spinner fa-spin fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    </div>

    <!-- Finished -->
    <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
        <a href="./?page=transactions&status=2" class="text-decoration-none">
            <div class="card bg-gradient-green-to-teal shadow-lg h-100 hover-lift border-0 text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="opacity-80 text-uppercase small font-weight-bold">Finished</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?php 
                                $total = $conn->query("SELECT * FROM transaction_list WHERE `status` = 2")->num_rows;
                                echo number_format($total);
                                ?>
                            </h2>
                        </div>
                        <div class="icon-solid bg-green">
                            <i class="fas fa-check-circle fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    </div>
</div>

<!-- Admin Extra Cards -->
<?php if($_settings->userdata('type') == 1): ?>
<div class="row">
    <!-- Delivered -->
    <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
        <a href="./?page=transactions&status=5" class="text-decoration-none">
            <div class="card bg-gradient-purple-to-pink shadow-lg h-100 hover-lift border-0 text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="opacity-80 text-uppercase small font-weight-bold">Delivered</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?php 
                                $total = $conn->query("SELECT * FROM transaction_list WHERE `status` = 5")->num_rows;
                                echo number_format($total);
                                ?>
                            </h2>
                        </div>
                        <div class="icon-solid bg-purple">
                            <i class="fas fa-truck fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    </div>
	
	<div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
    <a href="./?page=lenders" class="text-decoration-none">
        <div class="card bg-gradient-purple-to-pink shadow-lg h-100 hover-lift border-0 text-white">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="opacity-80 text-uppercase small font-weight-bold">Total Loan Balance</h6>
                        <h2 class="font-weight-bold mb-0">
                            <?php 
                            // Total Repayment (EMI * Tenure) - Total Paid
                            $loan_data = $conn->query("SELECT 
                                SUM(emi_amount * tenure_months) as total_payable,
                                (SELECT SUM(amount_paid) FROM loan_payments) as total_paid
                                FROM lender_list")->fetch_assoc();
                            $balance = ($loan_data['total_payable'] ?? 0) - ($loan_data['total_paid'] ?? 0);
                            echo "₹ " . number_format($balance);
                            ?>
                        </h2>
                    </div>
                    <div class="icon-solid bg-orange">
                        <i class="fas fa-hand-holding-usd fa-3x"></i>
                    </div>
                </div>
            </div>
        </div>
    </a>
</div>

    <!-- Paid -->
 <!--   <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
        <a href="./?page=transactions&status=3" class="text-decoration-none">
            <div class="card bg-gradient-yellow-to-orange shadow-lg h-100 hover-lift border-0 text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="opacity-80 text-uppercase small font-weight-bold">Paid</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?php 
                                $total = $conn->query("SELECT * FROM transaction_list WHERE `status` = 3")->num_rows;
                                echo number_format($total);
                                ?>
                            </h2>
                        </div>
                        <div class="icon-solid bg-yellow">
                            <i class="fas fa-rupee-sign fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    </div> -->

<div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
    <a href="javascript:void(0)" class="text-decoration-none">
        <div class="card bg-gradient-pink-to-red shadow-lg h-100 hover-lift border-0 text-white">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="opacity-80 text-uppercase small font-weight-bold">Today's Revenue</h6>
                        <h2 class="font-weight-bold mb-0">
                            ₹<?php 
                            $today = date('Y-m-d');
                            
                            // 1. Repair Jobs Revenue (Status 5 = Delivered)
                            // Note: Hum date_completed check kar rahe hain kyunki revenue completion date par count hona chahiye
                            $job_revenue_qry = $conn->query("SELECT SUM(amount) as total 
                                                            FROM transaction_list 
                                                            WHERE status = 5 
                                                            AND DATE(date_completed) = '$today'");
                            $job_revenue = $job_revenue_qry->fetch_assoc()['total'] ?? 0;

                            // 2. Direct Sales Revenue (Bina repair ke becha gaya samaan)
                            $direct_sales_qry = $conn->query("SELECT SUM(total_amount) as total 
                                                              FROM direct_sales 
                                                              WHERE DATE(date_created) = '$today'");
                            $direct_revenue = $direct_sales_qry->fetch_assoc()['total'] ?? 0;

                            // Kul Revenue
                            $total_today_revenue = $job_revenue + $direct_revenue;
                            
                            echo number_format($total_today_revenue, 2);
                            ?>
                        </h2>
                    </div>
                    <div class="icon-solid bg-pink">
                        <i class="fas fa-rupee-sign fa-3x"></i>
                    </div>
                </div>
            </div>
        </div>
    </a>
</div>

    <!-- Mechanics -->
    <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
        <a href="./?page=mechanics" class="text-decoration-none">
            <div class="card bg-gradient-indigo-to-purple shadow-lg h-100 hover-lift border-0 text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="opacity-80 text-uppercase small font-weight-bold">Mechanics</h6>
                            <h2 class="font-weight-bold mb-0">
                                <?php 
                                $total = $conn->query("SELECT * FROM mechanic_list WHERE delete_flag = 0")->num_rows;
                                echo number_format($total);
                                ?>
                            </h2>
                        </div>
                        <div class="icon-solid bg-indigo">
                            <i class="fas fa-user-cog fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    </div>
</div>

<?php 
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-t");

// =========================================================
// 1. Total Income (Repair Jobs + Direct Sales)
// =========================================================
$repair_income_qry = $conn->query("SELECT SUM(amount) FROM transaction_list 
                                   WHERE status = 5 
                                   AND DATE(date_completed) BETWEEN '{$from}' AND '{$to}'");
$repair_income = $repair_income_qry->fetch_array()[0] ?? 0;

$direct_sales_qry = $conn->query("SELECT SUM(total_amount) FROM direct_sales 
                                  WHERE DATE(date_created) BETWEEN '{$from}' AND '{$to}'");
$direct_income = $direct_sales_qry->fetch_array()[0] ?? 0;

$total_billed = $repair_income + $direct_income;


// =========================================================
// 2. Estimated Parts Cost (90% Logic)
// =========================================================
// Repair Job Parts
$repair_parts_val_qry = $conn->query("SELECT SUM(tp.price * tp.qty) 
                                      FROM transaction_products tp 
                                      INNER JOIN transaction_list t ON tp.transaction_id = t.id 
                                      WHERE t.status = 5 
                                      AND DATE(t.date_completed) BETWEEN '{$from}' AND '{$to}'");
$repair_parts_value = $repair_parts_val_qry->fetch_array()[0] ?? 0;

// Direct Sale Parts
$direct_parts_val_qry = $conn->query("SELECT SUM(ds.price * ds.qty) 
                                      FROM direct_sale_items ds 
                                      INNER JOIN direct_sales d ON ds.sale_id = d.id 
                                      WHERE DATE(d.date_created) BETWEEN '{$from}' AND '{$to}'");
$direct_parts_value = $direct_parts_val_qry->fetch_array()[0] ?? 0;

$total_parts_sold_value = $repair_parts_value + $direct_parts_value;

// COST ESTIMATION (90% of Selling Price)
$total_parts_cost = $total_parts_sold_value * 0.90;


// =========================================================
// 3. GROSS PROFIT (NEW CALCULATION)
// =========================================================
// Formula: Sales - Direct Parts Cost
$gross_profit = $total_billed - $total_parts_cost;


// =========================================================
// 4. Other Expenses & Deductions
// =========================================================
// Discount
$discount_qry = $conn->query("SELECT SUM(discount) FROM client_payments 
                              WHERE DATE(created_at) BETWEEN '{$from}' AND '{$to}'");
$total_discount = $discount_qry->fetch_array()[0] ?? 0;

// Shop Expenses
$expense_qry = $conn->query("SELECT SUM(amount) FROM expense_list 
                             WHERE DATE(date_created) BETWEEN '{$from}' AND '{$to}'");
$total_shop_expenses = $expense_qry->fetch_array()[0] ?? 0;

// Staff Salary
$salary_qry = $conn->query("SELECT 
    SUM(CASE 
        WHEN a.status = 1 THEN m.daily_salary 
        WHEN a.status = 3 THEN (m.daily_salary / 2) 
        ELSE 0 END) as total_salary 
    FROM attendance_list a 
    INNER JOIN mechanic_list m ON a.mechanic_id = m.id 
    WHERE a.curr_date BETWEEN '{$from}' AND '{$to}'");
$total_staff_salary = $salary_qry->fetch_assoc()['total_salary'] ?? 0;

// Loan EMI
$emi_qry = $conn->query("SELECT SUM(amount_paid) FROM loan_payments 
                         WHERE DATE(payment_date) BETWEEN '{$from}' AND '{$to}'");
$total_emi_paid = $emi_qry->fetch_array()[0] ?? 0;


// =========================================================
// 5. Final Net Profit Calculation
// =========================================================
// Indirect Expenses
$final_total_expense = $total_shop_expenses + $total_staff_salary + $total_emi_paid + $total_discount;

// Net Profit = Gross Profit - Indirect Expenses
$net_profit = $gross_profit - $final_total_expense;
?>

<div class="card card-outline card-primary shadow-sm mb-4">
    <div class="card-body">
        <form id="filter-form">
            <input type="hidden" name="p" value="home"> 
            <div class="row align-items-end">
                <div class="col-md-4">
                    <label>From Date</label>
                    <input type="date" name="from" class="form-control" value="<?= $from ?>" required>
                </div>
                <div class="col-md-4">
                    <label>To Date</label>
                    <input type="date" name="to" class="form-control" value="<?= $to ?>" required>
                </div>
                <div class="col-md-4">
                    <button class="btn btn-primary btn-flat"><i class="fa fa-filter"></i> Filter Results</button>
                    <a href="./?p=home" class="btn btn-default border btn-flat">Reset</a>
                </div>
            </div>
        </form>
    </div>
</div>

<div class="row">
    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-info elevation-1"><i class="fas fa-file-invoice-dollar"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Total Sales</span>
                <span class="info-box-number">₹ <?= number_format($total_billed, 2) ?></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-warning elevation-1"><i class="fas fa-tools"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Est. Parts Cost (90%)</span>
                <span class="info-box-number">₹ <?= number_format($total_parts_cost, 2) ?></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-primary elevation-1"><i class="fas fa-chart-pie"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Gross Profit (Sakal Laabh)</span>
                <span class="info-box-number">₹ <?= number_format($gross_profit, 2) ?></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-danger elevation-1"><i class="fas fa-tags"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Discounts Given</span>
                <span class="info-box-number">₹ <?= number_format($total_discount, 2) ?></span>
            </div>
        </div>
    </div>
    
    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-navy elevation-1"><i class="fas fa-user-cog"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Mechanic Salary</span>
                <span class="info-box-number">₹ <?= number_format($total_staff_salary, 2) ?></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-secondary elevation-1"><i class="fas fa-hand-holding-usd"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Loan Repayment</span>
                <span class="info-box-number">₹ <?= number_format($total_emi_paid, 2) ?></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-danger elevation-1"><i class="fas fa-wallet"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Total Outflow (Other Exp)</span>
                <span class="info-box-number">₹ <?= number_format($final_total_expense, 2) ?></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-success elevation-1"><i class="fas fa-chart-line"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Final Net Profit (Shuddh Laabh)</span>
                <span class="info-box-number" style="font-size:1.2rem;">₹ <?= number_format($net_profit, 2) ?></span>
            </div>
        </div>
    </div>
</div>
<!--
<div class="container-fluid text-center mt-4">
    <img src="<?= validate_image($_settings->info('cover')) ?>" alt="Banner" class="img-fluid rounded shadow-sm" style="max-height: 350px; width: 100%; object-fit: cover;">
</div>
-->
<?php endif; ?>
<style>
    .info-box-number { font-size: 1.3rem; font-weight: bold; }
    #filter-form label { font-weight: bold; color: #555; }
</style>
<!--
<script>
    $(function(){
        // Aap yahan koi bhi extra JS logic daal sakte hain
    })
</script>
-->
<!-- Banner Carousel -->
<div class="card shadow-lg rounded-lg mt-5 border-0 overflow-hidden">
    <div class="card-body p-0">
        <?php 
        $files = array();
        $fopen = @scandir(base_app.'uploads/banner');
        if($fopen){
            foreach($fopen as $fname){
                if(in_array($fname,array('.','..')))
                    continue;
                $files[] = validate_image('uploads/banner/'.$fname);
            }
        }
        ?>
        <?php if(count($files) > 0): ?>
        <div id="tourCarousel" class="carousel slide" data-ride="carousel" data-interval="4000">
            <div class="carousel-inner">
                <?php foreach($files as $k => $img): ?>
                <div class="carousel-item <?php echo $k == 0 ? 'active' : '' ?>">
                    <img class="d-block w-100" src="<?php echo $img ?>" alt="Banner <?= $k+1 ?>" style="max-height: 450px; object-fit: cover;">
                </div>
                <?php endforeach; ?>
            </div>
            <a class="carousel-control-prev" href="#tourCarousel" role="button" data-slide="prev">
                <span class="carousel-control-prev-icon bg-dark rounded-circle" aria-hidden="true"></span>
            </a>
            <a class="carousel-control-next" href="#tourCarousel" role="button" data-slide="next">
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

<!-- Super Colorful Dashboard Style -->
<style>
    .hover-lift {
        transition: all 0.4s ease;
    }
    .hover-lift:hover {
        transform: translateY(-12px) scale(1.02);
        box-shadow: 0 25px 50px rgba(0,0,0,0.3) !important;
    }
    .icon-solid {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 20px rgba(0,0,0,0.4);
    }
    .card {
        border-radius: 18px !important;
        overflow: hidden;
    }

    /* Vibrant Gradients */
    .bg-gradient-teal-to-cyan { background: linear-gradient(135deg, #20c997, #17a2b8) !important; }
    .bg-gradient-orange-to-red { background: linear-gradient(135deg, #fd7e14, #dc3545) !important; }
    .bg-gradient-blue-to-indigo { background: linear-gradient(135deg, #007bff, #6610f2) !important; }
    .bg-gradient-green-to-teal { background: linear-gradient(135deg, #28a745, #20c997) !important; }
    .bg-gradient-purple-to-pink { background: linear-gradient(135deg, #6f42c1, #e83e8c) !important; }
    .bg-gradient-yellow-to-orange { background: linear-gradient(135deg, #ffc107, #fd7e14) !important; }
    .bg-gradient-pink-to-red { background: linear-gradient(135deg, #e83e8c, #dc3545) !important; }
    .bg-gradient-indigo-to-purple { background: linear-gradient(135deg, #6610f2, #6f42c1) !important; }

    /* Solid Icon Colors */
    .bg-teal { background: #20c997 !important; }
    .bg-orange { background: #fd7e14 !important; }
    .bg-blue { background: #007bff !important; }
    .bg-green { background: #28a745 !important; }
    .bg-purple { background: #6f42c1 !important; }
    .bg-yellow { background: #ffc107 !important; }
    .bg-pink { background: #e83e8c !important; }
    .bg-indigo { background: #6610f2 !important; }

    #tourCarousel .carousel-item img {
        border-radius: 18px;
    }
    .carousel-control-prev-icon, .carousel-control-next-icon {
        width: 50px;
        height: 50px;
        background-size: 60%;
    }
</style>