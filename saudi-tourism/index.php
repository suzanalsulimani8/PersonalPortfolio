<?php include("config.php");?>
  <!DOCTYPE html>
 <html lang="en">
 <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Log in</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');

header {

background-color: #c8a17b;
top: 0;
left: 0;
width: 100%;
position: fixed;
z-index: 999;
display: flex;
justify-content: space-between;
align-items: center;
padding: 25px 35px ;
}



.navigation a{
color: #fff;
text-decoration: none;
font-size: 1.1em;
font-weight: 500;
padding-left: 30px;
}

.navigation a:hover{
color: #261400;
}

*{
    font-family: 'Poppins', sans-serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    scroll-behavior: smooth; 
}

body{
font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif;
}

.main{
text-align: center;
padding: 10px;
margin: 10px;
}

.main input, select{
padding: 8px;
margin: 8px;
background-color: rgb(245,245,245);
border: 1px rgb(226,226,226) solid;
outline: none;
border-radius: 3px;
}

select {
color: rgb(0,0,0);
}

input[type="submit"]{
background-color: rgba(88, 52, 24, 0.422);
width: 180px;
font-size: 17px;
color: white;
cursor: pointer;
}
input[type="submit"]:hover{
    transition: 0.6s;
    background-color:red;
}
#login {
    background-color: rgba(88, 52, 24, 0.422);
    color: white;
    padding: 8px;
    border-radius: 3px;
}
#login:hover{
    transition: 0.6s;
    background-color:red;
}
#error {
    background-color:rgb(255,175,175);
    color: rgb(255,0,0);
    padding: 4px;
}
</style>
  
 </head>
 <body>
 <header>
        <nav class="navigation">
            <a href="index.html">الرئيسية</a>

        </nav>
    </header>
<br><br><br><br>

 <div class="main">
 <h1>Log in</h1>
    <i>Let,s enjoy</i><br><br>
    <form action="index.php" method="post">
 <input type="username" name=" username" id="username" placeholder="username"><br>
 <input type="password" name="password" id="password" placeholder="password"><br>
 <input type="submit" name="submit" id="submit" value="submit"><br>

<h3>Or</h3><br>

<a id='login' href="loginn.php">Register</a>

 </from>

</div>
<?php
include("config.php");
session_start();
if (isset($_POST['save'])){
	 $username=$_POST['username'];
	 $password=$_POST['password'];
	 // $sql="insert into student (,username,password) values('','$username','$password')";
	 // $sql="insert into student values('','$username','$password') ";
	 $sql="insert into users (username,password) values('$username','$passwprd') ";
	 $res=mysqli_query($conn, $sql);
	 if ($res==true)
 echo"student informatio saved ok";}



// At the top of the page where you want to display the welcome message
if (isset($_SESSION['username'])) {
    // Retrieve the user's name from the session variable
    $username = $_SESSION['username'];

    // Display the welcome message using the user's name
    echo "<h1>Welcome, $username!</h1>";
}
?>

</body>
 </html>