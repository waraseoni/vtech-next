<?php 
// ==========================================
// 1. COMMON INITIALIZATION & LOGIC
// ==========================================

$user_type = $_settings->userdata('type'); // 1 = Admin, 2 = Staff
$user_mechanic_id = $_settings->userdata('mechanic_id');

// Detect Active Tab (Defaults to 'daily' unless 'report' is requested in URL)
$active_tab = isset($_GET['view']) && $_GET['view'] == 'report' ? 'report' : 'daily';

// --- LOGIC FOR DAILY ATTENDANCE (TAB 1) ---
$today = date('Y-m-d');
if($user_type == 1){
    $date = isset($_GET['date']) ? $_GET['date'] : $today;
} else {
    $date = $today; // Staff always sees today
}

// Daily Stats (Admin Only)
$present_count = 0; $absent_count = 0; $halfday_count = 0; $total_staff = 0;
if($user_type == 1){
    $total_staff = $conn->query("SELECT COUNT(*) as total FROM mechanic_list WHERE status = 1")->fetch_assoc()['total'];
    $present_count = $conn->query("SELECT COUNT(DISTINCT mechanic_id) as present FROM attendance_list WHERE status = 1 AND curr_date = '{$date}'")->fetch_assoc()['present'];
    $absent_count = $conn->query("SELECT COUNT(DISTINCT mechanic_id) as absent FROM attendance_list WHERE status = 2 AND curr_date = '{$date}'")->fetch_assoc()['absent'];
    $halfday_count = $conn->query("SELECT COUNT(DISTINCT mechanic_id) as halfday FROM attendance_list WHERE status = 3 AND curr_date = '{$date}'")->fetch_assoc()['halfday'];
}

// --- LOGIC FOR MONTHLY REPORT (TAB 2) ---
$month = isset($_GET['month']) ? $_GET['month'] : date("Y-m");
$days_in_month = date("t", strtotime($month));
$first_day_of_month = date("w", strtotime($month . "-01")); 

$prev_month = date('Y-m', strtotime($month . " -1 month"));
$next_month = date('Y-m', strtotime($month . " +1 month"));

// --- FIXED: COMMON MECHANICS QUERY FOR BOTH ADMIN AND STAFF ---
if($user_type == 1) {
    // Admin - all active mechanics
    $where = "WHERE status = 1";
    $mechanics = $conn->query("SELECT *, CONCAT(firstname,' ',lastname) as name FROM mechanic_list {$where} ORDER BY name ASC");
} else {
    // Staff - only their own record
    if(!empty($user_mechanic_id) && is_numeric($user_mechanic_id)) {
        // Check if mechanic exists and is active
        $check = $conn->query("SELECT COUNT(*) as count FROM mechanic_list WHERE id = '{$user_mechanic_id}' AND status = 1");
        if($check->fetch_assoc()['count'] > 0) {
            $mechanics = $conn->query("SELECT *, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE id = '{$user_mechanic_id}'");
        } else {
            // If mechanic not found, show empty result with error
            $mechanics = $conn->query("SELECT * FROM mechanic_list WHERE 1=0");
            $staff_error = "Your staff profile is not available or inactive. Please contact administrator.";
        }
    } else {
        // Invalid mechanic ID
        $mechanics = $conn->query("SELECT * FROM mechanic_list WHERE 1=0");
        $staff_error = "Invalid staff profile. Please contact administrator.";
    }
}
?>

<style>
    /* --- SHARED STYLES --- */
    .text-navy { color: #001f3f !important; }
    .bg-navy { background-color: #001f3f !important; color: white; }
    
    /* Custom Tabs Styling */
    .nav-tabs .nav-link { color: #495057; font-weight: 600; }
    .nav-tabs .nav-link.active { color: #001f3f; border-top: 3px solid #001f3f; font-weight: bold; }
    
    /* --- DAILY VIEW STYLES (From index.php) --- */
    .btn-group-toggle .btn input[type="radio"] { position: absolute; clip: rect(0,0,0,0); pointer-events: none; }
    .staff-avatar { width: 45px; height: 45px; background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; box-shadow: 0 3px 6px rgba(0,31,63,0.2); margin-right: 15px; }
    .status-btn { min-width: 90px; border-radius: 20px !important; margin: 0 2px; font-size: 0.85rem; font-weight: 500; }
    
    /* Active State Colors */
    .status-btn.btn-outline-warning.active { background-color: #ffc107 !important; color: #212529 !important; border-color: #ffc107 !important; }
    .status-btn.btn-outline-success.active { background-color: #28a745 !important; color: white !important; border-color: #28a745 !important; }
    .status-btn.btn-outline-danger.active { background-color: #dc3545 !important; color: white !important; border-color: #dc3545 !important; }

    /* Summary Cards */
    .summary-cards { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 20px; }
    .summary-card-item { flex: 1; text-align: center; padding: 15px 5px; border-radius: 8px; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #dee2e6; }
    .summary-count { font-size: 1.5rem; font-weight: 700; }
    .summary-label { font-size: 0.8rem; color: #6c757d; text-transform: uppercase; }
    
    /* --- CALENDAR/REPORT STYLES (From view_report.php) --- */
    .calendar-wrapper { width: 100%; margin: auto; }
    .month-nav { display: flex; align-items: center; gap: 8px; justify-content: center; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; background: #fff; padding: 5px; border-radius: 8px; }
    .calendar-day { aspect-ratio: 1/1; border-radius: 4px; display: flex; align-items: center; justify-content: center; border: 1px solid #f0f0f0; font-size: 0.8rem; font-weight: bold; position: relative; }
    
    <?php if($user_type == 1): ?>
    .calendar-day.clickable { cursor: pointer; }
    .calendar-day.clickable:hover { transform: scale(1.1); z-index: 5; box-shadow: 0 2px 5px rgba(0,0,0,0.2); border-color: #001f3f; }
    <?php endif; ?>

    .day-name { text-align: center; font-weight: bold; color: #999; font-size: 0.7rem; padding-bottom: 5px; }
    
    /* Calendar Colors */
    .status-1 { background-color: #28a745 !important; color: #fff !important; } /* Present */
    .status-3 { background-color: #ffc107 !important; color: #212529 !important; } /* Half Day */
    .status-0, .status-2 { background-color: #dc3545 !important; color: #fff !important; } /* Absent */
    .status-none { background-color: #f8f9fa; color: #ccc; } 
    .is-sunday { color: #dc3545; background-color: #fff5f5; }

    /* --- MOBILE RESPONSIVENESS --- */
    @media (max-width: 768px) {
        .desktop-only { display: none !important; }
        .mobile-only { 
            display: block !important; 
            padding-bottom: 100px; 
        }
        
        /* Mobile Card View for Daily */
        .attendance-card { background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 3px 8px rgba(0,0,0,0.05); border: 1px solid #e9ecef; }
        .mobile-status-btn { width: 100%; padding: 10px; margin-bottom: 5px; border-radius: 6px; text-align: left; border: 1px solid #ddd; }
        .mobile-status-btn.active { border: 2px solid currentColor; font-weight: bold; }
		
        /* FIXED: Button Position & Perfect Round Shape */
        .mobile-save-btn { 
            position: fixed; 
            bottom: 85px; /* Footer se upar */
            right: 25px; 
            width: 60px;  /* Width aur Height barabar honi chahiye */
            height: 60px; 
            border-radius: 50% !important; /* Perfect Gol karne ke liye */
            background: #001f3f; 
            color: white; 
            border: 2px solid white; 
            box-shadow: 0 5px 20px rgba(0,0,0,0.4); 
            z-index: 9999 !important; 
            font-size: 1.5rem; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            padding: 0; /* Padding hata di taaki andakar na ho */
            line-height: 0;
        }
        /* Calendar Mobile Adjustments */
        .calendar-grid { grid-template-columns: repeat(7, 30px); justify-content: center; }
        .calendar-day { font-size: 0.7rem; height: 30px; }
    }
    @media (min-width: 769px) {
        .mobile-only { display: none !important; }
        .desktop-only { display: block !important; }
    }
</style>

<div class="card card-navy card-outline shadow-sm">
    <div class="card-header p-0 border-bottom-0">
        <ul class="nav nav-tabs" id="attendanceTabs" role="tablist">
            <li class="nav-item">
                <a class="nav-link <?php echo $active_tab == 'daily' ? 'active' : '' ?>" id="daily-tab" data-toggle="pill" href="#daily-view" role="tab" aria-controls="daily-view" aria-selected="true">
                    <i class="fas fa-clipboard-check mr-2"></i>Mark Attendance
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?php echo $active_tab == 'report' ? 'active' : '' ?>" id="report-tab" data-toggle="pill" href="#report-view" role="tab" aria-controls="report-view" aria-selected="false">
                    <i class="fas fa-calendar-alt mr-2"></i>Monthly Report
                </a>
            </li>
        </ul>
    </div>
    
    <div class="card-body">
        <div class="tab-content" id="attendanceTabsContent">
            
            <div class="tab-pane fade <?php echo $active_tab == 'daily' ? 'show active' : '' ?>" id="daily-view" role="tabpanel" aria-labelledby="daily-tab">
                <!-- STAFF ERROR MESSAGE (if any) -->
                <?php if(isset($staff_error) && !empty($staff_error)): ?>
                <div class="alert alert-danger text-center">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <?php echo $staff_error ?>
                </div>
                <?php endif; ?>
                
                <?php if($mechanics->num_rows > 0): ?>
                <form id="attendance-form">
                    <?php if($user_type == 1): ?>
                    <div class="row justify-content-center mb-4">
                        <div class="col-md-6">
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text bg-navy"><i class="fas fa-calendar-day"></i></span>
                                </div>
                                <input type="date" id="attendance_date" class="form-control" value="<?php echo $date ?>" max="<?php echo $today ?>">
                            </div>
                        </div>
                    </div>
                    <?php else: ?>
                        <input type="hidden" id="attendance_date" value="<?php echo $today ?>">
                        <div class="alert alert-light border text-center mb-3">
                            <strong><?php echo date("l, F d, Y", strtotime($today)) ?></strong>
                        </div>
                    <?php endif; ?>

                    <?php if($user_type == 1): ?>
             <!--       <div class="summary-cards desktop-only">
                        <div class="summary-card-item"><div class="summary-count text-success"><?php echo $present_count ?></div><div class="summary-label">Present</div></div>
                        <div class="summary-card-item"><div class="summary-count text-warning"><?php echo $halfday_count ?></div><div class="summary-label">Half Day</div></div>
                        <div class="summary-card-item"><div class="summary-count text-danger"><?php echo $absent_count ?></div><div class="summary-label">Absent</div></div>
                        <div class="summary-card-item"><div class="summary-count text-navy"><?php echo $total_staff ?></div><div class="summary-label">Total</div></div>
                    </div> -->
                    <?php endif; ?>

                    <div class="table-responsive desktop-only">
                        <table class="table table-hover border">
                            <thead class="bg-navy">
                                <tr>
                                    <th width="40%">Staff Name</th>
                                    <th width="60%" class="text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php 
                                // Reset pointer for desktop loop
                                $mechanics->data_seek(0);
                                while($row = $mechanics->fetch_assoc()):
                                    $attn = $conn->query("SELECT status FROM attendance_list WHERE mechanic_id = '{$row['id']}' AND curr_date = '{$date}'");
                                    $current_status = $attn->num_rows > 0 ? $attn->fetch_array()[0] : 0;
                                ?>
                                <tr>
                                    <td class="align-middle">
                                        <input type="hidden" name="mechanic_id[]" value="<?php echo $row['id'] ?>">
                                        
                                        <div class="d-flex align-items-center">
                                            <div class="staff-avatar"><?php echo substr($row['firstname'], 0, 1) ?></div>
                                            <div>
                                                <h6 class="mb-0 font-weight-bold"><?php echo $row['name'] ?></h6>
                                                <small class="text-muted"><?php echo $row['designation'] ?></small>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-center align-middle">
                                        <div class="btn-group btn-group-toggle" data-toggle="buttons">
                                            <label class="btn btn-outline-success status-btn <?php echo $current_status == 1 ? 'active' : '' ?>">
                                                <input type="radio" name="status[<?php echo $row['id'] ?>]" value="1" <?php echo $current_status == 1 ? 'checked' : '' ?>> Present
                                            </label>
                                            <label class="btn btn-outline-warning status-btn <?php echo $current_status == 3 ? 'active' : '' ?>">
                                                <input type="radio" name="status[<?php echo $row['id'] ?>]" value="3" <?php echo $current_status == 3 ? 'checked' : '' ?>> Half Day
                                            </label>
                                            <label class="btn btn-outline-danger status-btn <?php echo ($current_status == 0 || $current_status == 2) ? 'active' : '' ?>">
                                                <input type="radio" name="status[<?php echo $row['id'] ?>]" value="2" <?php echo ($current_status == 0 || $current_status == 2) ? 'checked' : '' ?>> Absent
                                            </label>
                                        </div>
                                    </td>
                                </tr>
                                <?php endwhile; ?>
                            </tbody>
                        </table>
                    </div>

                    <div class="mobile-only">
                        <?php 
                        // Reset pointer for mobile loop
                        $mechanics->data_seek(0);
                        while($row = $mechanics->fetch_assoc()):
                            $attn = $conn->query("SELECT status FROM attendance_list WHERE mechanic_id = '{$row['id']}' AND curr_date = '{$date}'");
                            $current_status = $attn->num_rows > 0 ? $attn->fetch_array()[0] : 0;
                        ?>
                        <div class="attendance-card">
                            <input type="hidden" name="mechanic_id[]" value="<?php echo $row['id'] ?>">

                            <div class="d-flex align-items-center mb-3 pb-2 border-bottom">
                                <div class="staff-avatar" style="width:40px; height:40px;"><?php echo substr($row['firstname'], 0, 1) ?></div>
                                <div>
                                    <h6 class="mb-0 font-weight-bold"><?php echo $row['name'] ?></h6>
                                    <small class="text-muted"><?php echo $row['designation'] ?></small>
                                </div>
                            </div>
                            <div class="mobile-status-buttons">
                                <label class="mobile-status-btn text-success <?php echo $current_status == 1 ? 'active' : '' ?>" onclick="selectMobile(this)">
                                    <input type="radio" name="status[<?php echo $row['id'] ?>]" value="1" <?php echo $current_status == 1 ? 'checked' : '' ?> style="display:none">
                                    <i class="fas fa-check-circle mr-2"></i> Present
                                </label>
                                <label class="mobile-status-btn text-warning <?php echo $current_status == 3 ? 'active' : '' ?>" onclick="selectMobile(this)">
                                    <input type="radio" name="status[<?php echo $row['id'] ?>]" value="3" <?php echo $current_status == 3 ? 'checked' : '' ?> style="display:none">
                                    <i class="fas fa-clock mr-2"></i> Half Day
                                </label>
                                <label class="mobile-status-btn text-danger <?php echo ($current_status == 0 || $current_status == 2) ? 'active' : '' ?>" onclick="selectMobile(this)">
                                    <input type="radio" name="status[<?php echo $row['id'] ?>]" value="2" <?php echo ($current_status == 0 || $current_status == 2) ? 'checked' : '' ?> style="display:none">
                                    <i class="fas fa-times-circle mr-2"></i> Absent
                                </label>
                            </div>
                        </div>
                        <?php endwhile; ?>
                    </div>

                    <div class="text-center mt-3 desktop-only">
                        <button class="btn btn-navy btn-lg px-5 rounded-pill shadow" type="submit">
                            <i class="fas fa-save mr-2"></i> Save Attendance
                        </button>
                    </div>
                    <button class="mobile-save-btn mobile-only" type="submit" id="mobileSaveBtn"><i class="fas fa-save"></i></button>
                </form>
                <?php elseif(!isset($staff_error)): ?>
                    <!-- No staff found message (only for admin) -->
                    <div class="text-center py-5">
                        <i class="fas fa-users-slash fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Active Staff Found</h5>
                        <p class="text-muted">Add staff members from the Staff Management section.</p>
                    </div>
                <?php endif; ?>
            </div>

            <div class="tab-pane fade <?php echo $active_tab == 'report' ? 'show active' : '' ?>" id="report-view" role="tabpanel" aria-labelledby="report-tab">
                <!-- STAFF ERROR MESSAGE (if any) -->
                <?php if(isset($staff_error) && !empty($staff_error)): ?>
                <div class="alert alert-danger text-center">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <?php echo $staff_error ?>
                </div>
                <?php endif; ?>
                
                <?php if($mechanics->num_rows > 0): ?>
                <div class="card bg-light border-0 mb-3">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-center flex-wrap">
                            <h5 class="mb-0 text-navy font-weight-bold d-none d-md-block">
                                <i class="fa fa-calendar-alt mr-1"></i> <?php echo date("F Y", strtotime($month)) ?>
                            </h5>
                            <div class="month-nav mx-auto mx-md-0">
                                <a href="./?page=attendance&view=report&month=<?php echo $prev_month ?>" class="btn btn-sm btn-navy"><i class="fa fa-chevron-left"></i></a>
                                <input type="month" id="filter_month" class="form-control form-control-sm font-weight-bold" style="width: 150px;" value="<?php echo $month ?>">
                                <a href="./?page=attendance&view=report&month=<?php echo $next_month ?>" class="btn btn-sm btn-navy"><i class="fa fa-chevron-right"></i></a>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <?php 
                    // Reset pointer for report loop
                    $mechanics->data_seek(0);
                    while($row = $mechanics->fetch_assoc()):
                        // Get Monthly Stats
                        $p_res = $conn->query("SELECT SUM(IF(status=1,1,0)) as full_day, SUM(IF(status=3,1,0)) as half_day FROM attendance_list WHERE mechanic_id = '{$row['id']}' AND curr_date LIKE '{$month}%'")->fetch_assoc();
                    ?>
                    <div class="col-md-6 col-lg-4 mb-4">
                        <div class="card h-100 shadow-sm border">
                            <div class="card-header bg-white border-bottom-0 pb-0">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="font-weight-bold text-navy"><?php echo $row['name'] ?></span>
                                    <div style="font-size: 0.8rem;">
                                        <span id="p_count_<?php echo $row['id'] ?>" class="badge badge-success">P: <?php echo $p_res['full_day'] ?? 0 ?></span>
                                        <span id="h_count_<?php echo $row['id'] ?>" class="badge badge-warning">H: <?php echo $p_res['half_day'] ?? 0 ?></span>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body pt-2">
                                <div class="calendar-grid">
                                    <div class="day-name">S</div><div class="day-name">M</div><div class="day-name">T</div>
                                    <div class="day-name">W</div><div class="day-name">T</div><div class="day-name">F</div><div class="day-name">S</div>

                                    <?php 
                                    for($x = 0; $x < $first_day_of_month; $x++) echo '<div class="calendar-day border-0"></div>';
                                    
                                    for($i = 1; $i <= $days_in_month; $i++):
                                        $current_date = $month . "-" . str_pad($i, 2, '0', STR_PAD_LEFT);
                                        $day_of_week = date('w', strtotime($current_date));
                                        
                                        // Specific day query
                                        $check = $conn->query("SELECT status FROM attendance_list WHERE mechanic_id = '{$row['id']}' AND curr_date = '{$current_date}'");
                                        $res = $check->fetch_array();
                                        
                                        $status = $res ? (int)$res[0] : 'none';
                                        $class = ($status === 'none') ? 'status-none' : 'status-' . $status;
                                        if($day_of_week == 0) $class .= " is-sunday";
                                        $clickable = ($user_type == 1) ? 'clickable' : '';
                                    ?>
                                        <div class="calendar-day <?php echo $class ?> <?php echo $clickable ?>" 
                                             <?php if($user_type == 1): ?>
                                             onclick="confirmAttendanceUpdate('<?php echo $row['id'] ?>', '<?php echo addslashes($row['name']) ?>', '<?php echo $current_date ?>')"
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
                <?php elseif(!isset($staff_error)): ?>
                    <!-- No staff found message (only for admin) -->
                    <div class="text-center py-5">
                        <i class="fas fa-users-slash fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Active Staff Found</h5>
                        <p class="text-muted">Add staff members from the Staff Management section.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="updateModal" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-dialog-centered modal-sm" role="document">
        <div class="modal-content border-0">
            <div class="modal-body text-center p-4">
                <h6 class="font-weight-bold" id="m_name">Staff</h6>
                <p class="text-muted small mb-3" id="m_date">Date</p>
                <div class="d-flex flex-column gap-2">
                    <button class="btn btn-success btn-sm mb-2" onclick="processSingleUpdate(1)">Present</button>
                    <button class="btn btn-warning btn-sm mb-2" onclick="processSingleUpdate(3)">Half Day</button>
                    <button class="btn btn-danger btn-sm mb-2" onclick="processSingleUpdate(2)">Absent</button>
                    <button class="btn btn-light btn-sm" data-dismiss="modal">Cancel</button>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    // --- SHARED UTILS ---
    function selectMobile(element) {
        // Handle Mobile Radio Button UI
        let container = $(element).closest('.mobile-status-buttons');
        container.find('.mobile-status-btn').removeClass('active');
        $(element).addClass('active');
        $(element).find('input[type="radio"]').prop('checked', true);
    }

    // --- REPORT VIEW LOGIC ---
    let updateData = {};
    function confirmAttendanceUpdate(mid, name, date) {
        updateData = { mid, date };
        $('#m_name').text(name);
        $('#m_date').text(date);
        $('#updateModal').modal('show');
    }

    function processSingleUpdate(status) {
        $('#updateModal').modal('hide');
        start_loader();
        
        // Target element (Jis din par click kiya gaya)
        let targetDay = $(`.calendar-day[onclick*="'${updateData.mid}'"][onclick*="'${updateData.date}'"]`);

        // --- LOGIC START: Purana Status Pata Lagana ---
        // Update se pehle check karein ki abhi kya class lagi hai
        let oldStatus = 0; // Default (Absent/None)
        if (targetDay.hasClass('status-1')) {
            oldStatus = 1; // Pehle Present tha
        } else if (targetDay.hasClass('status-3')) {
            oldStatus = 3; // Pehle Half Day tha
        }
        // --- LOGIC END ---

        $.ajax({
            url: _base_url_+"classes/Master.php?f=save_attendance",
            method: 'POST',
            data: {
                'mechanic_id[]': [updateData.mid],
                ['status[' + updateData.mid + ']']: status,
                'curr_date': updateData.date
            },
            dataType: 'json',
            success: function(resp) {
                if (resp.status == 'success') {
                    alert_toast("Updated Successfully", 'success');
                    
                    // 1. Color Change Logic (Jo pehle se tha)
                    targetDay.removeClass('status-1 status-2 status-3 status-none');
                    targetDay.addClass('status-' + status);

                    // 2. NEW LOGIC: Numbers Update Karna (Real-time)
                    
                    // Element select karein (Step 1 wali IDs use karke)
                    let p_el = $('#p_count_' + updateData.mid);
                    let h_el = $('#h_count_' + updateData.mid);
                    
                    // Text me se number nikalein (e.g., "P: 5" -> 5)
                    let p_val = parseInt(p_el.text().split(': ')[1]);
                    let h_val = parseInt(h_el.text().split(': ')[1]);

                    // Agar status change hua hai tabhi calculation karein
                    if (oldStatus != status) {
                        
                        // A. Purana count ghatayein (Minus)
                        if (oldStatus == 1) p_val--; // Agar pehle Present tha to P kam karo
                        if (oldStatus == 3) h_val--; // Agar pehle Half Day tha to H kam karo

                        // B. Naya count badhayein (Plus)
                        if (status == 1) p_val++; // Agar ab Present hai to P badhao
                        if (status == 3) h_val++; // Agar ab Half Day hai to H badhao
                        
                        // C. Wapas HTML me update karein
                        p_el.text('P: ' + p_val);
                        h_el.text('H: ' + h_val);
                    }

                    end_loader();
                } else {
                    alert_toast("Failed", 'error');
                    end_loader();
                }
            },
            error: function(){ 
                alert_toast("An error occurred", 'error');
                end_loader(); 
            }
        });
    }

    // --- PAGE INIT ---
    $(function(){
        
        // 1. Date/Month Filters
        $('#attendance_date').change(function(){
            location.href = "./?page=attendance&date=" + $(this).val();
        });
        
        $('#filter_month').change(function(){
            // Keep user on Report Tab
            location.href = "./?page=attendance&view=report&month=" + $(this).val();
        });

        // 2. Daily Attendance Form Submit
        $('#attendance-form').submit(function(e){
            e.preventDefault();
            var selected_date = $('#attendance_date').val();
            
            start_loader();
            $.ajax({
                url: _base_url_+"classes/Master.php?f=save_attendance",
                method: 'POST',
                data: $(this).serialize() + "&curr_date=" + selected_date,
                dataType: 'json',
                success: function(resp){
                    if(resp.status == 'success'){
                        // Mobile Button Animation
                        if($('#mobileSaveBtn').is(':visible')) {
                            $('#mobileSaveBtn').html('<i class="fas fa-check"></i>').css('background', '#28a745');
                        }
                        alert_toast(resp.msg, 'success');
                        setTimeout(function(){ location.reload(); }, 1500);
                    } else {
                        alert_toast(resp.msg, 'error');
                    }
                    end_loader();
                },
                error: function(err) {
                    console.log(err);
                    alert_toast("An error occurred", 'error');
                    end_loader();
                }
            });
        });
    });
</script>