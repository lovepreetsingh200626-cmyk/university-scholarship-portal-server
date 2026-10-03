const express = require('express');

const {
    getAllStudents,
    getStudentById
} = require('../controllers/adminStudentController');

const {
    protect,
    adminOnly
} = require('../middleware/authMiddleware');


const router = express.Router();


/* ============================================================
   ADMIN STUDENT ROUTES
============================================================ */

/*
   GET /api/admin/students

   Get all registered students.
   Optional search:
   /api/admin/students?search=lovep
*/

router.get(
    '/',
    protect,
    adminOnly,
    getAllStudents
);


/*
   GET /api/admin/students/:id

   Get complete details of one student.
*/

router.get(
    '/:id',
    protect,
    adminOnly,
    getStudentById
);


module.exports = router;