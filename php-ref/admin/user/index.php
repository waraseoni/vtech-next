<?php 
// NOTE: 'config.php' और $conn ऑब्जेक्ट पहले से ही main index.php द्वारा शामिल किए गए हैं।
// पुराने insecure code को Prepared Statement से replace किया गया है।

$meta = [];
// 🛡️ SECURITY FIX: SQL Injection से बचने के लिए Prepared Statement का उपयोग
$stmt = $conn->prepare("SELECT * FROM users where id = ?");
$user_id = $_settings->userdata('id');
$stmt->bind_param("i", $user_id);
$stmt->execute();
$user = $stmt->get_result();

if($user->num_rows > 0){
    foreach($user->fetch_array() as $k =>$v){
        $meta[$k] = $v;
    }
}
$stmt->close(); 
?>

<?php if($_settings->chk_flashdata('success')): ?>
<script>
	alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')
</script>
<?php endif;?>
<div class="card card-outline rounded-0 card-navy">
	<div class="card-body">
		<div class="container-fluid">
			<div id="msg"></div>
			<form action="" id="manage-user">	
				<input type="hidden" name="id" value="<?php echo $_settings->userdata('id') ?>">
				<div class="form-group">
					<label for="name">First Name</label>
					<input type="text" name="firstname" id="firstname" class="form-control" value="<?php echo isset($meta['firstname']) ? $meta['firstname']: '' ?>" required>
				</div>
				<div class="form-group">
					<label for="name">Last Name</label>
					<input type="text" name="lastname" id="lastname" class="form-control" value="<?php echo isset($meta['lastname']) ? $meta['lastname']: '' ?>" required>
				</div>
				<div class="form-group">
					<label for="username">Username</label>
					<input type="text" name="username" id="username" class="form-control" value="<?php echo isset($meta['username']) ? $meta['username']: '' ?>" required  autocomplete="off">
				</div>
				<div class="input-group">
        <input type="password" name="password" id="password" class="form-control" value="" autocomplete="off" 
               <?= isset($meta['id']) ? "" : "required" ?> 
               placeholder="Enter new password (leave blank to keep current)">
        
        <div class="input-group-append">
            <button class="btn btn-outline-secondary" type="button" id="togglePassword">
                <i class="fa fa-eye" aria-hidden="true"></i> 
            </button>
        </div>
    </div>
				<div class="form-group">
					<label for="" class="control-label">Avatar</label>
					<div class="custom-file">
		              <input type="file" class="custom-file-input rounded-circle" id="customFile" name="img" onchange="displayImg(this,$(this))" accept="image/png, image/jpeg">
		              <label class="custom-file-label" for="customFile">Choose file</label>
		            </div>
				</div>
				<div class="form-group d-flex justify-content-center">
					<img src="<?php echo validate_image(isset($meta['avatar']) ? $meta['avatar'] :'') ?>" alt="" id="cimg" class="img-fluid img-thumbnail">
				</div>
			</form>
		</div>
	</div>
	<div class="card-footer">
			<div class="col-md-12">
				<div class="row">
					<button class="btn btn-sm btn-primary" form="manage-user">Update</button>
				</div>
			</div>
		</div>
</div>
<style>
	img#cimg{
		height: 15vh;
		width: 15vh;
		object-fit: cover;
		border-radius: 100% 100%;
	}
</style>
<script>
    // ... displayImg function aur baki code
    
    $(document).ready(function() {
        // ... $('#manage-user').submit(...) function
        
        // Password Toggle Logic yahan add karein
        $('#togglePassword').click(function(e) {
            e.preventDefault(); // Button ko form submit karne se rokta hai
            
            const passwordField = $('#password');
            
            // Current type check karein
            const currentType = passwordField.attr('type');
            
            // Naya type decide karein
            const newType = currentType === 'password' ? 'text' : 'password';
            
            // Input field ka type change karein
            passwordField.attr('type', newType);
            
            // Icon ki class toggle karein (fa-eye <-> fa-eye-slash)
            $(this).find('i').toggleClass('fa-eye fa-eye-slash');
        });
        
    });
    
    // ...
</script>
<script>
	function displayImg(input,_this) {
	    if (input.files && input.files[0]) {
	        var reader = new FileReader();
	        reader.onload = function (e) {
	        	$('#cimg').attr('src', e.target.result);
	        }

	        reader.readAsDataURL(input.files[0]);
	    }else{
			$('#cimg').attr('src', "<?php echo validate_image(isset($meta['avatar']) ? $meta['avatar'] :'') ?>");
		}
	}
	$('#manage-user').submit(function(e){
		e.preventDefault();
		start_loader()
		$.ajax({
			url:_base_url_+'classes/Users.php?f=save',
			data: new FormData($(this)[0]),
		    cache: false,
		    contentType: false,
		    processData: false,
		    method: 'POST',
		    type: 'POST',
			success:function(resp){
				if(resp ==1){
					location.reload()
				}else{
					$('#msg').html('<div class="alert alert-danger">Username already exist</div>')
					end_loader()
				}
			}
		})
	})

</script>