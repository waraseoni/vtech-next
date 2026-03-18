// Dashboard pe low stock warning + red badge
$(document).ready(function(){
    $.get('ajax/low_stock_check.php', function(data){
        if(data > 0){
            $('#low_stock_badge').html(data).show();
            toastr.error(data + ' items stock 5 se kam hai!');
        }
    });
});