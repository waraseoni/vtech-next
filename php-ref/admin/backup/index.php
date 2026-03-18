<?php if($_settings->chk_flashdata('success')): ?>
<script>alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')</script>
<?php endif;?>

<div class="card card-outline card-primary">
    <div class="card-header">
        <h3 class="card-title"><b>Database Backup</b></h3>
        <div class="card-tools">
            <a href="javascript:void(0)" id="create_backup" class="btn btn-flat btn-primary">
                <span class="fas fa-plus"></span> Create New Backup
            </a>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            <div class="alert alert-info">
                <i class="fa fa-info-circle"></i> Click "Create New Backup" to download full database backup (.sql file).
            </div>

            <table class="table table-hover table-striped table-bordered">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Backup Date</th>
                        <th>File Name</th>
                        <th>Size</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $i = 1;
                    $backup_dir = __DIR__ . "/../../classes/backups/"; // classes folder को point करो
                    if(!is_dir($backup_dir)) mkdir($backup_dir, 0777, true);
                    
                    $files = scandir($backup_dir);
                    $files = array_diff($files, array('.', '..'));
                    rsort($files); // Latest first
                    
                    foreach($files as $file):
                        if(pathinfo($file, PATHINFO_EXTENSION) != 'sql') continue;
                        $filepath = $backup_dir . $file;
                        $filesize = round(filesize($filepath) / 1024, 2); // KB
                    ?>
                    <tr>
                        <td><?= $i++ ?></td>
                        <td><?= date("M d, Y h:i A", filemtime($filepath)) ?></td>
                        <td><?= $file ?></td>
                        <td><?= $filesize ?> KB</td>
                        <td align="center">
                            <a href="./backup/backups/<?= $file ?>" class="btn btn-flat btn-sm btn-success" download>
                                <i class="fa fa-download"></i> Download
                            </a>
                            <button type="button" class="btn btn-flat btn-sm btn-danger delete_backup" data-file="<?= $file ?>">
                                <i class="fa fa-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if(count($files) == 0 || $i == 1): ?>
                    <tr>
                        <td colspan="5" class="text-center">No backup found.</td>
                    </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
$(document).ready(function(){
    $('#create_backup').click(function(){
        _conf("Are you sure to create a new database backup now?","create_backup",[]);
    });

    $('.delete_backup').click(function(){
        _conf("Are you sure to delete this backup permanently?","delete_backup",[$(this).attr('data-file')]);
    });

    $('.table').dataTable();
});

function create_backup(){
    start_loader();
    $.ajax({
        url:_base_url_+"classes/Master.php?f=create_backup",
        method:"POST",
        dataType:"json",
        success:function(resp){
            if(resp.status == 'success'){
                location.reload();
            }else{
                alert_toast("An error occurred",'error');
            }
            end_loader();
        }
    });
}

function delete_backup(file){
    start_loader();
    $.ajax({
        url:_base_url_+"classes/Master.php?f=delete_backup",
        method:"POST",
        data:{file:file},
        dataType:"json",
        success:function(resp){
            if(resp.status == 'success'){
                location.reload();
            }else{
                alert_toast("An error occurred",'error');
            }
            end_loader();
        }
    });
}
</script>