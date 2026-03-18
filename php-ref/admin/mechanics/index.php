<?php if($_settings->chk_flashdata('success')): ?>
<script>
	alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')
</script>
<?php endif;?>
<div class="content">
    <div class="container-fluid py-3">
        
        <!-- Header Card -->
        <div class="row mb-4">
            <div class="col-md-12">
                <div class="card bg-dark-card border-0 shadow-lg">
                    <div class="card-body p-4">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <div class="d-flex align-items-center">
                                    <div class="mr-3">
                                        <div class="icon-circle bg-primary-soft">
                                            <i class="fas fa-users text-primary"></i>
                                        </div>
                                    </div>
                                    <div>
                                        <h2 class="text-light mb-1">Mechanics Directory</h2>
                                        <p class="text-muted mb-0">Manage all mechanics in your workshop</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4 text-right">
                                <button id="create_new" class="btn btn-success btn-lg">
                                    <i class="fas fa-user-plus mr-2"></i> Add New Mechanic
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Statistics Cards -->
        <div class="row mb-4">
            <?php 
            $total_mechanics = $conn->query("SELECT COUNT(*) FROM mechanic_list WHERE delete_flag = 0")->fetch_array()[0] ?? 0;
            $active_mechanics = $conn->query("SELECT COUNT(*) FROM mechanic_list WHERE status = 1 AND delete_flag = 0")->fetch_array()[0] ?? 0;
            $inactive_mechanics = $conn->query("SELECT COUNT(*) FROM mechanic_list WHERE status = 0 AND delete_flag = 0")->fetch_array()[0] ?? 0;
            $total_salary = $conn->query("SELECT SUM(daily_salary) FROM mechanic_list WHERE status = 1 AND delete_flag = 0")->fetch_array()[0] ?? 0;
            ?>
            <div class="col-md-3">
                <div class="card bg-dark-card border-0 shadow-sm border-left-primary">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted d-block">TOTAL MECHANICS</small>
                                <h3 class="mb-0 text-primary"><?= $total_mechanics ?></h3>
                            </div>
                            <div class="icon-circle bg-primary-soft">
                                <i class="fas fa-users text-primary"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-dark-card border-0 shadow-sm border-left-success">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted d-block">ACTIVE</small>
                                <h3 class="mb-0 text-success"><?= $active_mechanics ?></h3>
                            </div>
                            <div class="icon-circle bg-success-soft">
                                <i class="fas fa-check-circle text-success"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-dark-card border-0 shadow-sm border-left-warning">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted d-block">INACTIVE</small>
                                <h3 class="mb-0 text-warning"><?= $inactive_mechanics ?></h3>
                            </div>
                            <div class="icon-circle bg-warning-soft">
                                <i class="fas fa-pause-circle text-warning"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-dark-card border-0 shadow-sm border-left-info">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted d-block">DAILY SALARY</small>
                                <h3 class="mb-0 text-info">₹ <?= number_format($total_salary, 2) ?></h3>
                            </div>
                            <div class="icon-circle bg-info-soft">
                                <i class="fas fa-money-bill-wave text-info"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Table -->
        <div class="row">
            <div class="col-md-12">
                <div class="card bg-dark-card border-0 shadow-lg">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover table-dark mb-0" id="list">
                                <thead class="bg-primary">
                                    <tr>
                                        <th class="text-center py-3" style="width: 50px;">#</th>
                                        <th class="text-center py-3" style="width: 80px;">Photo</th>
                                        <th class="py-3" style="min-width: 180px;">Name / Contact</th>
                                        <th class="py-3" style="width: 120px;">Designation</th>
                                        <th class="text-center py-3" style="width: 100px;">Salary</th>
                                        <th class="text-center py-3" style="width: 100px;">Comm. (%)</th>
                                        <th class="text-center py-3" style="width: 120px;">Joined</th>
                                        <th class="text-center py-3" style="width: 100px;">Status</th>
                                        <th class="text-center py-3" style="width: 100px;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php 
                                        $i = 1;
                                        $qry = $conn->query("SELECT *, concat(firstname, ' ', coalesce(concat(middlename, ' '), ''), lastname) as `name` from `mechanic_list` where delete_flag = 0 order by `name` asc ");
                                        while($row = $qry->fetch_assoc()):
                                            $avatar = !empty($row['avatar']) ? $row['avatar'] : 'default-avatar.jpg';
                                            $avatar_url = validate_image('uploads/avatars/'.$avatar); 
                                    ?>
                                    <tr>
                                        <td class="text-center align-middle"><?php echo $i++; ?></td>
                                        <td class="text-center align-middle">
                                            <div class="avatar-sm mx-auto">
                                                <img src="<?php echo $avatar_url ?>" alt="Avatar" class="rounded-circle border border-primary" width="40" height="40" style="object-fit:cover" onerror="this.src='<?php echo validate_image('uploads/avatars/default-avatar.jpg') ?>'">
                                            </div>
                                        </td>
                                        <td class="align-middle">
                                            <div><b class="text-light"><?php echo $row['name'] ?></b></div>
                                            <small class="text-muted d-block">
                                                <i class="fa fa-phone-alt mr-1"></i> <?php echo $row['contact'] ?>
                                            </small>
                                        </td>
                                        <td class="align-middle">
                                            <span class="badge badge-info"><?php echo $row['designation'] ?></span>
                                        </td>
                                        <td class="text-center align-middle">
                                            <span class="badge badge-warning">
                                                ₹<?php echo number_format($row['daily_salary'], 2) ?>
                                            </span>
                                        </td>
                                        <td class="text-center align-middle">
                                            <span class="badge badge-secondary">
                                                <?php echo isset($row['commission_perc']) ? $row['commission_perc'] : '0' ?>%
                                            </span>
                                        </td>
                                        <td class="text-center align-middle">
                                            <small class="text-muted">
                                                <?php echo isset($row['date_added']) ? date("M d, Y", strtotime($row['date_added'])) : 'N/A' ?>
                                            </small>
                                        </td>
                                        <td class="text-center align-middle">
                                            <?php if($row['status'] == 1): ?>
                                                <span class="badge badge-success badge-sm">
                                                    Active
                                                </span>
                                            <?php else: ?>
                                                <span class="badge badge-secondary badge-sm">
                                                    Inactive
                                                </span>
                                            <?php endif; ?>
                                        </td>
                                        <td class="text-center align-middle">
                                            <div class="action-buttons">
                                                <a href="./?page=mechanics/view_mechanic&id=<?php echo $row['id'] ?>" class="btn btn-sm btn-outline-primary mr-1" title="View">
                                                    <i class="fa fa-eye"></i>
                                                </a>
                                                <button class="btn btn-sm btn-outline-info edit_data mr-1" data-id="<?php echo $row['id'] ?>" title="Edit">
                                                    <i class="fa fa-edit"></i>
                                                </button>
                                                <button class="btn btn-sm btn-outline-danger delete_data" data-id="<?php echo $row['id'] ?>" title="Delete">
                                                    <i class="fa fa-trash"></i>
                                                </button>
                                            </div>
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

<script>
$(document).ready(function(){
    $('.delete_data').click(function(){
        _conf("Are you sure to delete this mechanic permanently?", "delete_mechanic", [$(this).attr('data-id')]);
    });
    
    $('#create_new').click(function(){
        uni_modal("<i class='fa fa-plus'></i> Add New Mechanic", "mechanics/manage_mechanic.php", "mid-large");
    });
    
    $('.edit_data').click(function(){
        uni_modal("<i class='fa fa-edit'></i> Edit Mechanic Details", "mechanics/manage_mechanic.php?id="+$(this).attr('data-id'), "mid-large");
    });
    
    // Initialize DataTable with fixed column widths
    $('#list').DataTable({
        "pageLength": 10,
        "order": [[2, "asc"]], // Sort by Name column
        "responsive": true,
        "scrollX": true,
        "autoWidth": false,
        "columnDefs": [
            { "width": "50px", "targets": 0 },
            { "width": "80px", "targets": 1 },
            { "width": "180px", "targets": 2 },
            { "width": "120px", "targets": 3 },
            { "width": "100px", "targets": 4 },
            { "width": "100px", "targets": 5 },
            { "width": "120px", "targets": 6 },
            { "width": "100px", "targets": 7 },
            { "width": "100px", "targets": 8, "orderable": false }
        ],
        "language": {
            "emptyTable": "No mechanics found",
            "info": "Showing _START_ to _END_ of _TOTAL_ mechanics",
            "infoEmpty": "Showing 0 to 0 of 0 entries",
            "infoFiltered": "(filtered from _MAX_ total entries)",
            "lengthMenu": "Show _MENU_ entries",
            "search": "Search mechanics...",
            "paginate": {
                "first": "First",
                "last": "Last",
                "next": "Next",
                "previous": "Previous"
            }
        }
    });
});

function delete_mechanic($id){
    start_loader();
    $.ajax({
        url: _base_url_+"classes/Master.php?f=delete_mechanic",
        method: "POST",
        data: {id: $id},
        dataType: "json",
        error: err => {
            console.log(err);
            alert_toast("An error occurred.", 'error');
            end_loader();
        },
        success: function(resp){
            if(typeof resp == 'object' && resp.status == 'success'){
                location.reload();
            } else {
                alert_toast("An error occurred.", 'error');
                end_loader();
            }
        }
    });
}
</script>

<style>
/* Dark Theme Variables */
:root {
    --dark-bg: #121826;
    --dark-card: #1e2536;
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
.bg-dark-card {
    background: var(--dark-card) !important;
    border: 1px solid var(--dark-border) !important;
}

.border-left-primary { border-left: 4px solid var(--primary) !important; }
.border-left-success { border-left: 4px solid var(--success) !important; }
.border-left-warning { border-left: 4px solid var(--warning) !important; }
.border-left-info { border-left: 4px solid var(--info) !important; }
.border-left-danger { border-left: 4px solid var(--danger) !important; }

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
.bg-success-soft { background: rgba(16, 185, 129, 0.15) !important; }
.bg-warning-soft { background: rgba(245, 158, 11, 0.15) !important; }
.bg-info-soft { background: rgba(14, 165, 233, 0.15) !important; }
.bg-danger-soft { background: rgba(239, 68, 68, 0.15) !important; }

/* Table Styles */
.table-dark {
    background-color: transparent;
    color: var(--text-light);
    border-color: var(--dark-border);
    margin-bottom: 0;
    width: 100% !important;
}

.table-dark thead th {
    background-color: rgba(0, 0, 0, 0.3);
    border-color: var(--dark-border);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
    white-space: nowrap;
}

.table-dark tbody td {
    border-color: var(--dark-border);
    vertical-align: middle;
    white-space: nowrap;
}

.table-dark tbody tr {
    transition: all 0.2s ease;
}

.table-dark tbody tr:hover {
    background-color: rgba(255, 255, 255, 0.05);
}

/* Action Buttons - Fixed to prevent overlap */
.action-buttons {
    display: flex;
    justify-content: center;
    gap: 5px;
    min-width: 120px;
}

.action-buttons .btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 0.85rem;
}

/* Avatar Styles */
.avatar-sm {
    width: 40px;
    height: 40px;
    margin: 0 auto;
}

.avatar-sm img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* Badge Styles */
.badge {
    font-weight: 500;
    padding: 0.35em 0.65em;
    border-radius: 6px;
    font-size: 0.8rem;
    display: inline-block;
    white-space: nowrap;
}

.badge-sm {
    padding: 0.25em 0.5em;
    font-size: 0.75rem;
}

/* Button Styles */
.btn {
    border-radius: 6px;
    font-weight: 500;
    transition: all 0.2s;
    white-space: nowrap;
}

.btn-success {
    background: linear-gradient(135deg, var(--success) 0%, #0d8b61 100%);
    border: none;
}

.btn-success:hover {
    background: linear-gradient(135deg, #0d8b61 0%, var(--success) 100%);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(16, 185, 129, 0.3);
}

.btn-outline-primary,
.btn-outline-info,
.btn-outline-danger {
    border-width: 1px;
}

.btn-outline-primary:hover {
    background-color: var(--primary);
    color: white;
}

.btn-outline-info:hover {
    background-color: var(--info);
    color: white;
}

.btn-outline-danger:hover {
    background-color: var(--danger);
    color: white;
}

/* DataTable Customization */
.dataTables_wrapper {
    padding: 1rem;
}

.dataTables_filter input {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid var(--dark-border) !important;
    color: var(--text-light) !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 6px !important;
    margin-left: 0.5rem !important;
    min-width: 200px;
}

.dataTables_filter label,
.dataTables_length label {
    color: var(--text-muted) !important;
}

.dataTables_length select {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid var(--dark-border) !important;
    color: var(--text-light) !important;
    padding: 0.375rem 1.75rem 0.375rem 0.75rem !important;
    border-radius: 6px !important;
}

.dataTables_info {
    color: var(--text-muted) !important;
    padding-top: 1rem !important;
}

.dataTables_paginate .pagination {
    margin-top: 1rem !important;
}

.page-link {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid var(--dark-border) !important;
    color: var(--text-muted) !important;
    margin: 0 2px;
    border-radius: 4px !important;
    min-width: 32px;
    text-align: center;
}

.page-link:hover {
    background-color: rgba(255, 255, 255, 0.1) !important;
    border-color: var(--primary) !important;
    color: var(--text-light) !important;
}

.page-item.active .page-link {
    background-color: var(--primary) !important;
    border-color: var(--primary) !important;
    color: white !important;
}

/* Fix for horizontal scroll on small screens */
.table-responsive {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

/* Modal Fix for Dark Theme */
.modal-content {
    background-color: var(--dark-card) !important;
    color: var(--text-light) !important;
    border: 1px solid var(--dark-border) !important;
}

.modal-header {
    background-color: rgba(0, 0, 0, 0.3) !important;
    border-bottom: 1px solid var(--dark-border) !important;
    color: var(--text-light) !important;
}

.modal-title {
    color: var(--text-light) !important;
}

.modal-body {
    background-color: var(--dark-card) !important;
    color: var(--text-light) !important;
}

.modal-body label {
    color: #d1d5db !important;
}

.modal-body .form-control {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border-color: var(--dark-border) !important;
    color: var(--text-light) !important;
}

.modal-body .form-control:focus {
    background-color: rgba(255, 255, 255, 0.08) !important;
    border-color: var(--primary) !important;
    color: var(--text-light) !important;
}

.modal-body .input-group-text {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border-color: var(--dark-border) !important;
    color: var(--text-muted) !important;
}

.modal-footer {
    background-color: rgba(0, 0, 0, 0.3) !important;
    border-top: 1px solid var(--dark-border) !important;
}

/* Responsive */
@media (max-width: 768px) {
    .icon-circle {
        width: 40px;
        height: 40px;
        font-size: 16px;
    }
    
    .btn-lg {
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
    }
    
    .action-buttons {
        flex-direction: column;
        gap: 3px;
        min-width: auto;
    }
    
    .action-buttons .btn {
        width: 28px;
        height: 28px;
        font-size: 0.75rem;
    }
    
    .table-dark thead th,
    .table-dark tbody td {
        font-size: 0.8rem;
        padding: 0.5rem;
    }
    
    .badge {
        font-size: 0.7rem;
        padding: 0.2em 0.4em;
    }
}

/* Extra small devices */
@media (max-width: 576px) {
    .action-buttons {
        flex-direction: row;
        gap: 2px;
    }
    
    .dataTables_filter input {
        min-width: 150px;
    }
}
</style>