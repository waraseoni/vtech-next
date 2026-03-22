<!-- Main Sidebar Container -->
<aside class="main-sidebar sidebar-dark-primary elevation-4">
    <!-- Brand Logo -->
    <a href="<?php echo base_url ?>admin" class="brand-link bg-gradient-navy text-sm">
        <img src="<?php echo validate_image($_settings->info('logo'))?>" alt="Store Logo" 
             class="brand-image img-circle elevation-3" style="opacity: .8;width: 1.8rem;height: 1.8rem;">
        <span class="brand-text font-weight-light"><?php echo $_settings->info('short_name') ?></span>
    </a>

    <!-- Sidebar -->
    <div class="sidebar">
        <nav class="mt-2">
            <ul class="nav nav-pills nav-sidebar flex-column text-sm nav-compact nav-flat nav-child-indent" data-widget="treeview" role="menu" data-accordion="false">
                
                <li class="nav-item">
                    <a href="./" class="nav-link nav-home">
                        <i class="nav-icon fas fa-tachometer-alt text-info"></i>
                        <p>Dashboard</p>
                    </a>
                </li>
                
				<li class="nav-item">
                    <a href="./?page=attendance" class="nav-link nav-attendance">
                        <i class="nav-icon fas fa-calendar-check text-purple"></i>
                        <p><?php echo ($_settings->userdata('type') == 1) ? 'Attendance' : 'Mark My Attendance'; ?></p>
                    </a>
                </li>
				<!--
                <li class="nav-item">
                    <a href="./?page=attendance" class="nav-link nav-attendance">
                        <i class="nav-icon fas fa-calendar-check text-purple"></i>
                        <p><?php echo ($_settings->userdata('type') == 1) ? 'Daily Attendance' : 'Mark My Attendance'; ?></p>
                    </a>
                </li>
                
                <li class="nav-item">
                    <a href="./?page=attendance/view_report" class="nav-link nav-attendance_view_report">
                        <i class="nav-icon fas fa-clipboard-list text-teal"></i>
                        <p><?php echo ($_settings->userdata('type') == 1) ? 'Attendance Chart' : 'My Attendance'; ?></p>                        
                    </a>
                </li>
                -->
                <li class="nav-item">
                    <a href="./?page=clients" class="nav-link nav-clients">
                        <i class="nav-icon fas fa-user-friends text-success"></i>
                        <p>Clients List</p>
                    </a>
                </li>

                <li class="nav-item">
                    <a href="./?page=inquiries" class="nav-link nav-inquiries">
                        <i class="nav-icon fas fa-question-circle text-warning"></i>
                        <p>Inquiries</p>
                    </a>
                </li>

                <li class="nav-item">
                    <a href="./?page=direct_sales" class="nav-link">
                        <i class="nav-icon fas fa-cash-register text-primary"></i>
                        <p>Direct Sales</p>
                    </a>
                </li>

                <li class="nav-item">
                    <a href="./?page=inventory" class="nav-link nav-inventory">
                        <i class="nav-icon fas fa-clipboard-check text-cyan"></i>
                        <p>Inventory</p>
                    </a>
                </li>

                <li class="nav-item">
                    <a href="./?page=transactions" class="nav-link nav-transactions">
                        <i class="nav-icon fas fa-clipboard-list text-orange"></i>
                        <p>JobSheet</p>
                    </a>
                </li>

                <?php if($_settings->userdata('type') == 1): ?>

                <!-- Reports Section -->
                <li class="nav-header text-light opacity-70">Reports</li>
                <li class="nav-item has-treeview">
                    <a href="#" class="nav-link">
                        <i class="nav-icon fas fa-chart-bar text-purple"></i>
                        <p>Reports <i class="right fas fa-angle-left"></i></p>
                    </a>
                    <ul class="nav nav-treeview">
						<li class="nav-item">
    <a href="<?php echo base_url ?>admin/?page=reports/delivered_report" class="nav-link">
        <i class="nav-icon fas fa-truck-loading"></i>
        <p>
            Delivered Report
        </p>
    </a>
</li>
                        <li class="nav-item"><a href="./?page=reports/cash_flow_report" class="nav-link"><i class="nav-icon fas fa-chart-line"></i><p>Cash Flow</p></a></li>
                        <li class="nav-item"><a href="./?page=reports/ledger_report" class="nav-link"><i class="nav-icon fas fa-chart-line"></i><p>Business Ledger</p></a></li>
                        <li class="nav-item"><a href="./?page=reports/year_repo" class="nav-link"><i class="nav-icon fas fa-chart-line"></i><p>Yearly Report</p></a></li>
                        <li class="nav-item"><a href="./?page=reports/client_payment_report" class="nav-link"><i class="nav-icon fas fa-chart-line"></i><p>Clients Payment</p></a></li>
                        <li class="nav-item"><a href="./?page=reports/daily_sales_report" class="nav-link"><i class="nav-icon fas fa-rupee-sign text-purple"></i><p>Daily Sales Report</p></a></li>
                        <li class="nav-item"><a href="./?page=reports/daily_service_report" class="nav-link"><i class="nav-icon fas fa-wrench text-teal"></i><p>Daily Service Report</p></a></li>
                        <li class="nav-item"><a href="./?page=reports/custom_sales_report" class="nav-link"><i class="nav-icon fas fa-shopping-cart text-pink"></i><p>Custom Sales Report</p></a></li>
                        <li class="nav-item"><a href="./?page=reports/custom_service_report" class="nav-link"><i class="nav-icon fas fa-file-alt text-indigo"></i><p>Custom Service Report</p></a></li>
                    </ul>
                </li>
                
                <!-- Back Office Section -->
                <li class="nav-header text-light opacity-70">Back Office</li>
                <li class="nav-item has-treeview">
                    <a href="#" class="nav-link">
                        <i class="nav-icon fas fa-tools text-lime"></i>
                        <p>Back Office <i class="right fas fa-angle-left"></i></p>
                    </a>
                    <ul class="nav nav-treeview">
                        <!--<li class="nav-item"><a href="./?page=attendance/salary_report" class="nav-link"><i class="nav-icon fas fa-money-check-alt"></i><p>Salary</p></a></li>-->
						<li class="nav-item"><a href="<?php echo base_url ?>admin/?page=expenses/finance_report" class="nav-link"><i class="nav-icon fas fa-money-bill-wave"></i><p>Pay Outs</p></a></li>
                     <!--   <li class="nav-item"><a href="./?page=attendance/advance_ledger" class="nav-link"><i class="nav-icon fas fa-hand-holding-usd"></i><p>Advance</p></a></li>-->
                        <li class="nav-item"><a href="<?php echo base_url ?>admin/?page=salery/salary_management" class="nav-link"><i class="nav-icon fas fa-hand-holding-usd"></i><p>Salary</p></a></li>
                        <li class="nav-item"><a href="<?php echo base_url ?>admin/?page=mechanics/commission_history" class="nav-link"><i class="nav-icon fas fa-coins"></i><p>Commission</p></a></li>
                        <li class="nav-item"><a href="./?page=services" class="nav-link"><i class="nav-icon fas fa-th-list"></i><p>Services</p></a></li>
                        <li class="nav-item"><a href="./?page=products" class="nav-link"><i class="nav-icon fas fa-cogs"></i><p>Products</p></a></li>
                        <li class="nav-item"><a href="./?page=mechanics" class="nav-link"><i class="nav-icon fas fa-user-friends"></i><p>Mechanics</p></a></li>
                        <li class="nav-item"><a href="./?page=clients_admin" class="nav-link"><i class="nav-icon fas fa-users-cog"></i><p>Client Amt</p></a></li>
                     <!--   <li class="nav-item"><a href="<?php echo base_url ?>admin/?page=expenses" class="nav-link"><i class="nav-icon fas fa-money-bill-wave"></i><p>Expenses</p></a></li> -->
                        <li class="nav-item"><a href="<?php echo base_url ?>admin/?page=lenders" class="nav-link"><i class="nav-icon fas fa-hand-holding-usd"></i><p>Loan</p></a></li>
						<li class="nav-item"><a href="<?php echo base_url ?>admin/?page=loans" class="nav-link"><i class="nav-icon fas fa-hand-holding-usd"></i><p>Client Loan</p></a></li>
                        <li class="nav-item"><a href="./?page=user/list" class="nav-link"><i class="nav-icon fas fa-users-cog"></i><p>Users</p></a></li>
                        <li class="nav-item"><a href="./?page=backup" class="nav-link"><i class="nav-icon fas fa-download"></i><p>Backup</p></a></li>
                        <li class="nav-item"><a href="./?page=system_info" class="nav-link"><i class="nav-icon fas fa-cog"></i><p>Settings</p></a></li>
                    </ul>
                </li>

                <?php endif; ?>
            </ul>
        </nav>
    </div>
</aside>

<style>
	/* Default AdminLTE sidebar width is 250px */
.main-sidebar {
    width: 200px !important; /* नई चौड़ाई */
}

/* Content wrapper adjustment */
.content-wrapper,
.main-footer,
.main-header {
    margin-left: 200px !important; /* Sidebar की चौड़ाई के बराबर */
}

/* Collapsed state */
.sidebar-collapse .main-sidebar {
    transform: translateX(-200px) !important;
}

.sidebar-collapse .content-wrapper,
.sidebar-collapse .main-footer,
.sidebar-collapse .main-header {
    margin-left: 0 !important;
}
	
    .main-sidebar { background: #343a40 !important; }
    .brand-link { background: linear-gradient(180deg, #007bff, #0056b3) !important; }
    .brand-text { font-size: 1.1rem; font-weight: 500; }

    .nav-sidebar .nav-link {
        padding: 8px 15px !important;
        margin: 2px 8px;
        border-radius: 6px;
        font-size: 0.9rem !important;
        transition: all 0.3s ease;
    }

    .nav-treeview .nav-link { padding-left: 45px !important; font-size: 0.9rem !important; }

    .nav-sidebar .nav-link:hover {
        background: rgba(255,255,255,0.15) !important;
        transform: translateX(8px);
    }

    .nav-sidebar .nav-link.active {
        background: linear-gradient(90deg, #007bff, #0056b3) !important;
        color: #fff !important;
        font-weight: 600;
        box-shadow: 0 4px 15px rgba(0,123,255,0.4);
    }

    .nav-header {
        padding: 15px 20px 5px;
        font-size: 0.8rem;
        color: rgba(255,255,255,0.6) !important;
        letter-spacing: 1px;
    }

    .sidebar {
        height: calc(100vh - 56px);
        overflow-y: auto;
        padding-bottom: 30px;
    }
	@media (max-width: 767.98px) {
    /* Mobile par left sidebar ko hide karein */
    .main-sidebar {
        display: none !important;
    }
    /* Content ko full width karein aur bottom bar ke liye jagah chhodein */
    .content-wrapper {
        margin-left: 0 !important;
        margin-bottom: 60px !important; 
    }
    /* Hamburger menu icon (top bar) ko hide karein */
    .nav-link[data-widget="pushmenu"] {
        display: none !important;
    }
}
</style>

<script>
$(function () {
    var page = '<?php echo isset($_GET['page']) ? $_GET['page'] : 'home' ?>';
    page = page.replace(/\//g, '_');

    if ($('.nav-link.nav-' + page).length > 0) {
        $('.nav-link.nav-' + page).addClass('active');
        $('.nav-link.nav-' + page).closest('.has-treeview').addClass('menu-open');
    }
});
</script>