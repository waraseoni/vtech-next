<?php 
// Date range
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-d");

// Mechanic filter
$mechanic_id = isset($_GET['mechanic_id']) ? $_GET['mechanic_id'] : 'all';

// Build WHERE clause
$where = "date(a.date_paid) BETWEEN '{$from}' AND '{$to}'";
if ($mechanic_id != 'all') {
    $where .= " AND a.mechanic_id = '{$mechanic_id}'";
}

// Selected mechanic name for print header
$selected_mechanic = "All Staff";
if ($mechanic_id != 'all') {
    $m_qry = $conn->query("SELECT CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE id = {$mechanic_id}");
    if ($m_qry->num_rows > 0) {
        $selected_mechanic = $m_qry->fetch_array()['name'];
    }
}
?>
<div class="card card-outline card-navy shadow">
    <div class="card-header">
        <h3 class="card-title text-navy font-weight-bold">
            <i class="fas fa-hand-holding-usd mr-2 text-warning"></i> 
            Advance & Part Payment Ledger
        </h3>
        <div class="card-tools">
            <button class="btn btn-success btn-flat btn-sm shadow-sm mr-2" type="button" id="print">
                <i class="fa fa-print"></i> Print Report
            </button>
            <button class="btn btn-primary btn-flat btn-sm shadow-sm" type="button" id="create_new">
                <i class="fa fa-plus"></i> Add New Entry
            </button>
        </div>
    </div>
    <div class="card-body">
        <div class="row mb-4 justify-content-center align-items-end">
            <div class="col-md-3">
                <div class="form-group mb-0">
                    <label class="control-label text-muted small">From Date</label>
                    <input type="date" id="from_date" class="form-control form-control-sm shadow-sm" value="<?php echo $from ?>" style="border-radius: 5px;">
                </div>
            </div>
            <div class="col-md-3">
                <div class="form-group mb-0">
                    <label class="control-label text-muted small">To Date</label>
                    <input type="date" id="to_date" class="form-control form-control-sm shadow-sm" value="<?php echo $to ?>" style="border-radius: 5px;">
                </div>
            </div>
            <div class="col-md-3">
                <div class="form-group mb-0">
                    <label class="control-label text-muted small">Staff / Mechanic</label>
                    <select id="mechanic_select" class="form-control form-control-sm shadow-sm" style="border-radius: 5px;">
                        <option value="all" <?php echo ($mechanic_id == 'all') ? 'selected' : '' ?>>All Staff</option>
                        <?php 
                        $mechanics = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name FROM mechanic_list ORDER BY name");
                        while($row = $mechanics->fetch_assoc()):
                        ?>
                        <option value="<?php echo $row['id'] ?>" <?php echo ($mechanic_id == $row['id']) ? 'selected' : '' ?>><?php echo $row['name'] ?></option>
                        <?php endwhile; ?>
                    </select>
                </div>
            </div>
            <div class="col-md-2">
                <button class="btn btn-navy btn-sm btn-block shadow-sm" type="button" id="filter_data" style="border-radius: 5px;">
                    <i class="fa fa-filter"></i> Filter
                </button>
            </div>
        </div>

        <div id="out-print">
            <div class="table-responsive">
                <table class="table table-bordered table-striped table-hover">
                    <thead>
                        <tr class="bg-navy text-white">
                            <th class="text-center">Date</th>
                            <th>Staff Name</th>
                            <th class="text-right">Amount</th>
                            <th>Reason / Note</th>
                            <th class="text-center d-print-none">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $qry = $conn->query("SELECT a.*, CONCAT(m.firstname,' ',m.lastname) as name FROM advance_payments a INNER JOIN mechanic_list m ON a.mechanic_id = m.id WHERE {$where} ORDER BY a.date_paid DESC");
                        
                        $total_advance = 0;
                        while($row = $qry->fetch_assoc()):
                            $total_advance += $row['amount'];
                        ?>
                        <tr>
                            <td class="text-center"><?php echo date("M d, Y", strtotime($row['date_paid'])) ?></td>
                            <td><div class="font-weight-bold"><?php echo $row['name'] ?></div></td>
                            <td class="text-right font-weight-bold text-danger">₹ <?php echo number_format($row['amount'], 2) ?></td>
                            <td><small><?php echo $row['reason'] ?></small></td>
                            <td align="center" class="d-print-none">
                                <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon shadow-sm" data-toggle="dropdown">Action</button>
                                <div class="dropdown-menu" role="menu">
                                    <a class="dropdown-item edit_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-edit text-primary"></span> Edit</a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-item delete_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
                                </div>
                            </td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                    <tfoot>
                        <tr class="bg-light">
                            <th colspan="2" class="text-right font-weight-bold">Total Advance Paid:</th>
                            <th class="text-right font-weight-bold text-danger" style="font-size: 1.1rem">₹ <?php echo number_format($total_advance, 2) ?></th>
                            <th colspan="2" class="d-print-none"></th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>
</div>

<script>
    $(function(){
        // Updated Filter Logic with Mechanic
        $('#filter_data').click(function(){
            var from = $('#from_date').val();
            var to = $('#to_date').val();
            var mechanic = $('#mechanic_select').val();
            location.href = "./?page=attendance/advance_ledger&from=" + from + "&to=" + to + "&mechanic_id=" + mechanic;
        })

        // Print Logic - with selected staff name
        $('#print').click(function(){
            var head = $('head').clone();
            var p = $('#out-print').clone();
            var el = $("<div>");
            
            head.append('<style>body{background-color:white !important; padding: 20px;} .bg-navy{background-color:#001f3f !important; color:white !important; -webkit-print-color-adjust: exact;} .table{width:100%; border-collapse:collapse;} .table-bordered th, .table-bordered td{border:1px solid #dee2e6 !important; padding:8px;} .d-print-none{display:none !important;}</style>');
            
            el.append(head);
            el.append('<h2 class="text-center"><?php echo $_settings->info('name') ?></h2>');
            el.append('<h4 class="text-center text-muted">Advance Payment Report - <?php echo $selected_mechanic; ?></h4>');
            el.append('<p class="text-center small">Period: <?php echo date("M d, Y", strtotime($from)) ?> to <?php echo date("M d, Y", strtotime($to)) ?></p><hr/>');
            el.append(p);
            el.append('<div style="margin-top:50px; display:flex; justify-content:space-between;"><div style="border-top:1px solid #000; width:200px; text-align:center;">Staff Signature</div><div style="border-top:1px solid #000; width:200px; text-align:center;">Admin Signature</div></div>');
            
            var nw = window.open("","","width=1100,height=900");
                nw.document.write(el.html());
                nw.document.close();
                setTimeout(() => {
                    nw.print();
                    setTimeout(() => {
                        nw.close();
                    }, 200);
                }, 500);
        });

        // Modal actions remain same
        $('#create_new').click(function(){
            uni_modal("<i class='fa fa-plus'></i> New Advance Entry", "attendance/manage_advance.php")
        })
        $('.edit_data').click(function(){
            uni_modal("<i class='fa fa-edit'></i> Edit Advance Entry", "attendance/manage_advance.php?id=" + $(this).attr('data-id'))
        })
        $('.delete_data').click(function(){
            _conf("Bhai, kya aap waqai is entry ko delete karna chahte hain?", "delete_advance", [$(this).attr('data-id')])
        })
    })

    function delete_advance($id){
        start_loader();
        $.ajax({
            url: _base_url_ + "classes/Master.php?f=delete_advance",
            method: "POST",
            data: {id: $id},
            dataType: "json",
            success: function(resp){
                if(resp.status == 'success'){
                    alert_toast("Deleted successfully", 'success');
                    setTimeout(function(){ location.reload(); }, 1000);
                } else {
                    alert_toast("Delete failed", 'error'); end_loader();
                }
            }
        })
    }
</script>