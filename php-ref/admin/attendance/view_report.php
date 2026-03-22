<?php 
$month = isset($_GET['month']) ? $_GET['month'] : date("Y-m");
$days_in_month = date("t", strtotime($month));
$first_day_of_month = date("w", strtotime($month . "-01")); 

$prev_month = date('Y-m', strtotime($month . " -1 month"));
$next_month = date('Y-m', strtotime($month . " +1 month"));

$user_type = $_settings->userdata('type');
$user_mechanic_id = $_settings->userdata('mechanic_id');
?>

<style>
    .calendar-wrapper { max-width: 1200px; margin: auto; }
    .report-nav-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    .month-nav { display: flex; align-items: center; gap: 8px; justify-content: center; }
    .staff-name-label { font-size: 1.1rem !important; font-weight: 800 !important; color: #001f3f; border-left: 4px solid #007bff; padding-left: 10px; text-transform: uppercase; }
    
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 38px); gap: 4px; background: #fff; padding: 10px; border-radius: 8px; justify-content: center; }
    .calendar-day { height: 35px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #eee; font-size: 0.85rem; font-weight: bold; position: relative; transition: all 0.2s; }
    
    <?php if($user_type == 1): ?>
    .calendar-day.clickable { cursor: pointer; }
    .calendar-day.clickable:hover { transform: scale(1.1); z-index: 5; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-color: #001f3f; }
    <?php endif; ?>

    .day-name { text-align: center; font-weight: bold; color: #999; font-size: 0.7rem; padding-bottom: 5px; }
    
    /* Colors Update */
    .status-1 { background-color: #28a745 !important; color: #fff !important; } /* Present */
    .status-3 { background-color: #ffc107 !important; color: #212529 !important; } /* Half Day - Orange/Yellow */
    .status-0, .status-2 { background-color: #dc3545 !important; color: #fff !important; } /* Absent */
    .status-none { background-color: #f8f9fa; color: #ccc; } 
    .is-sunday { color: #dc3545; background-color: #fff5f5; }

    .nav-arrow { padding: 6px 15px; background: #001f3f; border-radius: 6px; color: white !important; }
</style>

<div class="container-fluid py-2">
    <div class="calendar-wrapper">
        <div class="card shadow-sm mb-4 border-0">
            <div class="card-body py-3">
                <div class="report-nav-header">
                    <h4 class="mb-0 font-weight-bold text-navy"><i class="fa fa-calendar-check mr-2"></i> Monthly Attendance Report</h4>
                    <div class="month-nav">
                        <a href="./?page=attendance/view_report&month=<?php echo $prev_month ?>" class="nav-arrow"><i class="fa fa-chevron-left"></i></a>
                        <input type="month" id="filter_month" class="form-control font-weight-bold shadow-sm" style="width: 180px; border: 2px solid #001f3f;" value="<?php echo $month ?>">
                        <a href="./?page=attendance/view_report&month=<?php echo $next_month ?>" class="nav-arrow"><i class="fa fa-chevron-right"></i></a>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <?php 
            $where = ($user_type == 1) ? "WHERE status = 1" : "WHERE status = 1 AND id = '{$user_mechanic_id}'";
            $mechanics = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name FROM mechanic_list {$where} ORDER BY firstname ASC");
            
            while($row = $mechanics->fetch_assoc()):
            ?>
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="staff-name-label"><?php echo $row['name'] ?></span>
                            <?php 
                            // Counting Present and Half Days
                            $p_res = $conn->query("SELECT 
                                    SUM(IF(status=1,1,0)) as full_day,
                                    SUM(IF(status=3,1,0)) as half_day 
                                    FROM attendance_list WHERE mechanic_id = '{$row['id']}' AND curr_date LIKE '{$month}%'")->fetch_assoc();
                            ?>
                            <div class="d-flex flex-column align-items-end">
                                <span class="badge badge-success mb-1">Full: <?php echo $p_res['full_day'] ?? 0 ?></span>
                                <span class="badge badge-warning">Half: <?php echo $p_res['half_day'] ?? 0 ?></span>
                            </div>
                        </div>
                        
                        <div class="calendar-grid mx-auto border rounded">
                            <div class="day-name">S</div><div class="day-name">M</div><div class="day-name">T</div>
                            <div class="day-name">W</div><div class="day-name">T</div><div class="day-name">F</div>
                            <div class="day-name">S</div>

                            <?php 
                            for($x = 0; $x < $first_day_of_month; $x++) echo '<div class="calendar-day empty-day border-0"></div>';
                            
                            for($i = 1; $i <= $days_in_month; $i++):
                                $current_date = $month . "-" . str_pad($i, 2, '0', STR_PAD_LEFT);
                                $day_of_week = date('w', strtotime($current_date));
                                $check = $conn->query("SELECT status FROM attendance_list WHERE mechanic_id = '{$row['id']}' AND curr_date = '{$current_date}'");
                                $res = $check->fetch_array();
                                
                                $status = $res ? (int)$res[0] : 'none';
                                $class = ($status === 'none') ? 'status-none' : 'status-' . $status;
                                if($day_of_week == 0) $class .= " is-sunday";
                                
                                $clickable = ($user_type == 1) ? 'clickable' : '';
                            ?>
                                <div class="calendar-day <?php echo $class ?> <?php echo $clickable ?>" 
                                     <?php if($user_type == 1): ?>
                                     onclick="confirmAttendance('<?php echo $row['id'] ?>', '<?php echo addslashes($row['name']) ?>', '<?php echo $current_date ?>')"
                                     <?php endif; ?>>
                                    <?php echo $i ?>
                                </div>
                            <?php endfor; ?>
                        </div>
                    </div>
                </div>
            </div>
            <?php endwhile; ?>
        </div>
    </div>
</div>

<div class="modal fade" id="attendanceModal" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-sm" role="document">
        <div class="modal-content shadow-lg border-0" style="border-radius: 20px;">
            <div class="modal-body text-center p-4">
                <div class="mb-3"><i class="fa fa-user-edit fa-2x text-navy"></i></div>
                <h6 class="font-weight-bold mb-1" id="m_name">Staff Name</h6>
                <p class="text-muted small mb-4" id="m_date">Date</p>
                <div class="d-flex flex-column" style="gap: 10px;">
                    <button class="btn btn-success py-2 font-weight-bold" onclick="processUpdate(1)">
                        <i class="fa fa-check-circle mr-2"></i> Present
                    </button>
                    <button class="btn btn-warning py-2 font-weight-bold" onclick="processUpdate(3)">
                        <i class="fa fa-adjust mr-2"></i> Half Day
                    </button>
                    <button class="btn btn-danger py-2 font-weight-bold" onclick="processUpdate(2)">
                        <i class="fa fa-times-circle mr-2"></i> Absent
                    </button>
                    <button class="btn btn-light py-2 text-muted" data-dismiss="modal">Cancel</button>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    let selectedData = {};

    function confirmAttendance(mid, name, date) {
        selectedData = { mid, date };
        $('#m_name').text(name);
        $('#m_date').text(date);
        $('#attendanceModal').modal('show');
    }

    function processUpdate(status) {
        $('#attendanceModal').modal('hide');
        start_loader();
        
        $.ajax({
            url: "../classes/Master.php?f=save_attendance", 
            method: 'POST',
            data: {
                'mechanic_id[]': [selectedData.mid],
                ['status[' + selectedData.mid + ']']: status,
                'curr_date': selectedData.date
            },
            dataType: 'json',
            error: err => {
                console.log(err);
                alert_toast("An error occurred.", 'error');
                end_loader();
            },
            success: function(resp) {
                if (resp && resp.status == 'success') {
                    alert_toast("Attendance Updated", 'success');
                    setTimeout(() => location.reload(), 600);
                } else {
                    alert_toast(resp.msg || "Failed to update", 'error');
                    end_loader();
                }
            }
        });
    }

    $(function(){
        $('#filter_month').change(function(){
            location.href = "./?page=attendance/view_report&month=" + $(this).val();
        });
    });
</script>