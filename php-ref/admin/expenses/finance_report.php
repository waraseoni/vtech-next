<?php
// Variables initialize karein taaki error na aaye
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-d");
$mechanic_id = isset($_GET['mechanic_id']) ? $_GET['mechanic_id'] : 'all';
$category_filter = isset($_GET['category']) ? $_GET['category'] : 'all';
$active_tab = isset($_GET['tab']) ? $_GET['tab'] : 'salary';
?>

<div class="card card-outline card-navy shadow">
    <div class="card-header p-0 pt-1">
        <ul class="nav nav-tabs" id="financeTabs" role="tablist">
            <li class="nav-item">
                <a class="nav-link <?php echo $active_tab == 'salary' ? 'active' : '' ?>" id="salary-tab" data-toggle="pill" href="#salary-content" role="tab">
                    <i class="fas fa-hand-holding-usd mr-1"></i> Staff Salary & Advance
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?php echo $active_tab == 'expenses' ? 'active' : '' ?>" id="expenses-tab" data-toggle="pill" href="#expenses-content" role="tab">
                    <i class="fas fa-money-bill-wave mr-1"></i> Daily Expenses
                </a>
            </li>
        </ul>
    </div>

    <div class="card-body">
        <form action="" id="filter-form" method="GET">
            <input type="hidden" name="page" value="expenses/finance_report">
            <input type="hidden" name="tab" id="current_tab" value="<?php echo htmlspecialchars($active_tab) ?>">
            
            <div class="row mb-4 justify-content-center align-items-end">
                <div class="col-md-2">
                    <label class="small text-muted">From</label>
                    <input type="date" name="from" id="from_date" class="form-control form-control-sm" value="<?php echo htmlspecialchars($from) ?>">
                </div>
                <div class="col-md-2">
                    <label class="small text-muted">To</label>
                    <input type="date" name="to" id="to_date" class="form-control form-control-sm" value="<?php echo htmlspecialchars($to) ?>">
                </div>

                <div class="col-md-3 filter-group" id="staff-filter-group" style="display:<?php echo $active_tab == 'salary' ? 'block' : 'none' ?>;">
                    <label class="small text-muted">Select Staff</label>
                    <select name="mechanic_id" class="form-control form-control-sm">
                        <option value="all" <?php echo $mechanic_id == 'all' ? 'selected' : '' ?>>All Staff</option>
                        <?php 
                        $mechanics = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name, status FROM mechanic_list ORDER BY firstname ASC");
                        while($mrow = $mechanics->fetch_assoc()):
                            $status_text = ($mrow['status'] == 1) ? '' : ' (Inactive)';
                        ?>
                        <option value="<?php echo $mrow['id'] ?>" <?php echo $mechanic_id == $mrow['id'] ? 'selected' : '' ?> 
                                style="<?php echo ($mrow['status'] == 0) ? 'color:#6c757d;font-style:italic;' : '' ?>">
                            <?php echo htmlspecialchars($mrow['name']) . $status_text ?>
                        </option>
                        <?php endwhile; ?>
                    </select>
                </div>

                <div class="col-md-3 filter-group" id="expense-filter-group" style="display:<?php echo $active_tab == 'expenses' ? 'block' : 'none' ?>;">
                    <label class="small text-muted">Expense Category</label>
                    <select name="category" class="form-control form-control-sm">
                        <option value="all" <?php echo $category_filter == 'all' ? 'selected' : '' ?>>All Categories</option>
                        <?php 
                        $cats = $conn->query("SELECT DISTINCT category FROM expense_list ORDER BY category ASC");
                        while($crow = $cats->fetch_assoc()):
                        ?>
                        <option value="<?php echo htmlspecialchars($crow['category']) ?>" <?php echo $category_filter == $crow['category'] ? 'selected' : '' ?>>
                            <?php echo htmlspecialchars($crow['category']) ?>
                        </option>
                        <?php endwhile; ?>
                    </select>
                </div>

                <div class="col-md-4">
                    <div class="btn-group">
                        <button class="btn btn-navy btn-sm" type="submit">
                            <i class="fa fa-filter"></i> Apply
                        </button>
                        
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="setMonth('prev')">
                            <i class="fa fa-angle-left"></i> Prev Month
                        </button>
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="setMonth('next')">
                            Next Month <i class="fa fa-angle-right"></i>
                        </button>

                        <a href="./?page=expenses/finance_report" class="btn btn-outline-danger btn-sm">
                            <i class="fa fa-sync-alt"></i> Reset
                        </a>
                    </div>
                </div>
            </div>
        </form>

        <div class="tab-content" id="financeTabsContent">
            <div class="tab-pane fade <?php echo $active_tab == 'salary' ? 'show active' : '' ?>" id="salary-content" role="tabpanel">
                <div class="d-flex justify-content-between mb-2">
                    <h5 class="text-navy">Staff Advance Ledger</h5>
                    <button class="btn btn-primary btn-xs" id="create_advance"><i class="fa fa-plus"></i> New Advance</button>
                </div>
                <div class="table-responsive">
                    <table class="table table-bordered table-striped" id="salaryTable">
                        <thead class="bg-navy">
                            <tr>
                                <th>Date</th>
                                <th>Staff Name</th>
                                <th>Amount</th>
                                <th>Note</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $salary_where = "date(a.date_paid) BETWEEN '{$from}' AND '{$to}'";
                            if($mechanic_id != 'all') {
                                $salary_where .= " AND a.mechanic_id = '{$mechanic_id}'";
                            }
                            
                            // FIXED: Use LEFT JOIN so that rows with mechanic_id = 0 (or any non‑matching ID) are still shown
                            $salary_qry = $conn->query("SELECT a.*, CONCAT(m.firstname,' ',m.lastname) as name, m.status 
                                                        FROM advance_payments a 
                                                        LEFT JOIN mechanic_list m ON a.mechanic_id = m.id 
                                                        WHERE {$salary_where} 
                                                        ORDER BY a.date_paid DESC");
                            $total_salary = 0;
                            while($row = $salary_qry->fetch_assoc()):
                                $total_salary += $row['amount'];
                                
                                // Handle missing mechanic (mechanic_id = 0 or deleted)
                                if(empty($row['name'])) {
                                    $display_name = '<span class="text-muted"><i>Admin / Deleted Staff</i></span>';
                                    $staff_status_class = 'text-muted';
                                } else {
                                    $display_name = htmlspecialchars($row['name']);
                                    $staff_status_class = ($row['status'] == 0) ? 'text-muted' : '';
                                    if($row['status'] == 0) {
                                        $display_name .= ' <small class="badge badge-secondary ml-1">Inactive</small>';
                                    }
                                }
                            ?>
                            <tr>
                                <td><?php echo date("d-M-Y", strtotime($row['date_paid'])) ?></td>
                                <td>
                                    <b class="<?php echo $staff_status_class ?>">
                                        <?php echo $display_name ?>
                                    </b>
                                </td>
                                <td class="text-right text-danger">₹<?php echo number_format($row['amount'],2) ?></td>
                                <td><small><?php echo htmlspecialchars($row['reason']) ?></small></td>
                                <td align="center">
                                    <div class="btn-group">
                                        <button type="button" class="btn btn-flat btn-default btn-sm border edit_advance" data-id="<?php echo $row['id'] ?>">
                                            <i class="fa fa-edit text-primary"></i>
                                        </button>
                                        <button type="button" class="btn btn-flat btn-default btn-sm border delete_advance" data-id="<?php echo $row['id'] ?>">
                                            <i class="fa fa-trash text-danger"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                        <tfoot>
                            <tr class="bg-light">
                                <th colspan="2" class="text-right">Total Advance:</th>
                                <th class="text-right text-danger">₹<?php echo number_format($total_salary, 2) ?></th>
                                <th colspan="2"></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div class="tab-pane fade <?php echo $active_tab == 'expenses' ? 'show active' : '' ?>" id="expenses-content" role="tabpanel">
                <div class="d-flex justify-content-between mb-2">
                    <h5 class="text-navy">Business Expenses</h5>
                    <button class="btn btn-primary btn-xs" id="add_expense"><i class="fa fa-plus"></i> New Expense</button>
                </div>
                <div class="table-responsive">
                    <table class="table table-bordered table-striped" id="expenseTable">
                        <thead class="bg-primary text-white">
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Remarks</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $exp_where = "date(date_created) BETWEEN '{$from}' AND '{$to}'";
                            if($category_filter != 'all') {
                                $exp_where .= " AND category = '{$category_filter}'";
                            }
                            
                            $expense_qry = $conn->query("SELECT * FROM `expense_list` WHERE {$exp_where} ORDER BY date_created DESC");
                            $total_exp = 0;
                            while($row = $expense_qry->fetch_assoc()):
                                $total_exp += $row['amount'];
                            ?>
                            <tr>
                                <td><?php echo date("d-M-Y", strtotime($row['date_created'])) ?></td>
                                <td><?php echo htmlspecialchars($row['category']) ?></td>
                                <td class="text-right text-orange">₹<?php echo number_format($row['amount'],2) ?></td>
                                <td><?php echo htmlspecialchars($row['remarks']) ?></td>
                                <td align="center">
                                    <div class="btn-group">
                                        <button type="button" class="btn btn-flat btn-default btn-sm border edit_expense" data-id="<?php echo $row['id'] ?>">
                                            <i class="fa fa-edit text-primary"></i>
                                        </button>
                                        <button type="button" class="btn btn-flat btn-default btn-sm border delete_expense" data-id="<?php echo $row['id'] ?>">
                                            <i class="fa fa-trash text-danger"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                        <tfoot>
                            <tr class="bg-light">
                                <th colspan="2" class="text-right">Total Expenses:</th>
                                <th class="text-right text-primary">₹<?php echo number_format($total_exp, 2) ?></th>
                                <th colspan="2"></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
$(function(){
    // Initialize DataTables
    $('#salaryTable, #expenseTable').DataTable();
    
    // Tab switching logic
    $('a[data-toggle="pill"]').on('shown.bs.tab', function(e) {
        var tab = $(e.target).attr('href').replace('#', '').replace('-content', '');
        $('#current_tab').val(tab);
        toggleFilters(tab);
    });
    
    function toggleFilters(activeTab) {
        if(activeTab === 'salary') {
            $('#staff-filter-group').show();
            $('#expense-filter-group').hide();
            $('select[name="category"]').val('all');
        } else {
            $('#staff-filter-group').hide();
            $('#expense-filter-group').show();
            $('select[name="mechanic_id"]').val('all');
        }
    }
    toggleFilters('<?php echo $active_tab ?>');
    
    // Create buttons (static – no delegation needed)
    $('#create_advance').click(function(){
        uni_modal("<i class='fa fa-plus'></i> New Advance", "salery/manage_advance.php")
    });
    $('#add_expense').click(function(){
        uni_modal("<i class='fa fa-plus'></i> Add Expense", "expenses/manage_expense.php")
    });

    // ===== DELEGATED EVENTS FOR DYNAMIC BUTTONS =====
    // Edit Advance
    $(document).on('click', '.edit_advance', function(){
        uni_modal("<i class='fa fa-edit'></i> Edit Advance", "salery/manage_advance.php?id=" + $(this).data('id'))
    });

    // Delete Advance
    $(document).on('click', '.delete_advance', function(){
        if(!confirm("Are you sure you want to delete this advance record?")) return;
        var id = $(this).data('id');
        $.ajax({
            url: 'attendance/delete_advance.php',
            method: 'POST',
            data: {id: id},
            success: function(resp){
                if(resp.status == 'success'){
                    alert("Advance record deleted successfully!");
                    location.reload();
                } else {
                    alert("Error: " + resp.msg);
                }
            }
        });
    });

    // Edit Expense
    $(document).on('click', '.edit_expense', function(){
        uni_modal("<i class='fa fa-edit'></i> Edit Expense", "expenses/manage_expense.php?id=" + $(this).data('id'))
    });

    // Delete Expense
    $(document).on('click', '.delete_expense', function(){
        if(!confirm("Are you sure you want to delete this expense record?")) return;
        var id = $(this).data('id');
        $.ajax({
            url: 'expenses/delete_expense.php',
            method: 'POST',
            data: {id: id},
            success: function(resp){
                if(resp.status == 'success'){
                    alert("Expense record deleted successfully!");
                    location.reload();
                } else {
                    alert("Error: " + resp.msg);
                }
            }
        });
    });
});

// Fixed Month navigation function - पूरा महीना दिखाएगा
function setMonth(type) {
    var fromDate = new Date($('#from_date').val());
    var y = fromDate.getFullYear();
    var m = fromDate.getMonth();
    
    var firstDay, lastDay;
    
    if (type === 'prev') {
        // Previous month की पहली और आखिरी तारीख
        firstDay = new Date(y, m - 1, 1);
        lastDay = new Date(y, m, 0);
    } else {
        // Next month की पहली और आखिरी तारीख
        firstDay = new Date(y, m + 1, 1);
        lastDay = new Date(y, m + 2, 0);
    }
    
    // Format dates to YYYY-MM-DD
    function formatDate(date) {
        var d = date,
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();

        if (month.length < 2) 
            month = '0' + month;
        if (day.length < 2) 
            day = '0' + day;

        return [year, month, day].join('-');
    }
    
    $('#from_date').val(formatDate(firstDay));
    $('#to_date').val(formatDate(lastDay));
    
    // Submit the form
    $('#filter-form').submit();
}

// Alternative: Current month का option (अगर चाहें तो)
function setCurrentMonth() {
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth();
    
    var firstDay = new Date(y, m, 1);
    var lastDay = new Date(y, m + 1, 0);
    
    function formatDate(date) {
        var d = date,
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();

        if (month.length < 2) 
            month = '0' + month;
        if (day.length < 2) 
            day = '0' + day;

        return [year, month, day].join('-');
    }
    
    $('#from_date').val(formatDate(firstDay));
    $('#to_date').val(formatDate(lastDay));
    $('#filter-form').submit();
}
</script>

<style>
    .nav-tabs .nav-link.active {
        background-color: #001f3f !important;
        color: white !important;
        border-radius: 5px 5px 0 0;
    }
    .btn-navy {
        background: #001f3f;
        color: white;
    }
    .btn-navy:hover {
        background: #003366;
        color: white;
    }
    .text-orange {
        color: #fd7e14 !important;
    }
    .text-muted {
        color: #6c757d !important;
    }
    .badge-secondary {
        background-color: #6c757d;
        color: white;
        font-size: 0.7em;
        padding: 2px 6px;
    }
</style>