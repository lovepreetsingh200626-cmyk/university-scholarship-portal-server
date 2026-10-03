const User = require('../models/user');
const StudentProfile = require('../models/StudentProfile');
const ScholarshipApplication =
    require('../models/ScholarshipApplication');


/* ============================================================
   GET ALL STUDENTS
============================================================ */

const getAllStudents = async (req, res) => {

    try {

        const {
            search = ''
        } = req.query;


        const searchText =
            search.trim();


        const userQuery = {
            role: 'student'
        };


        if (searchText) {

            userQuery.$or = [
                {
                    name: {
                        $regex: searchText,
                        $options: 'i'
                    }
                },
                {
                    email: {
                        $regex: searchText,
                        $options: 'i'
                    }
                },
                {
                    mobile: {
                        $regex: searchText,
                        $options: 'i'
                    }
                }
            ];

        }


        const students =
            await User.find(
                userQuery
            )
                .select(
                    'name email mobile isActive createdAt'
                )
                .sort({
                    createdAt: -1
                })
                .lean();


        const studentIds =
            students.map(
                student => student._id
            );


        const profiles =
            await StudentProfile.find({
                user: {
                    $in: studentIds
                }
            })
                .select(
                    'user fullName registrationNumber course department academicYear currentSemester category profileCompleted'
                )
                .lean();


        const profileMap =
            new Map(
                profiles.map(
                    profile => [
                        profile.user.toString(),
                        profile
                    ]
                )
            );


        const applicationCounts =
            await ScholarshipApplication.aggregate([
                {
                    $match: {
                        student: {
                            $in: studentIds
                        }
                    }
                },

                {
                    $group: {
                        _id: '$student',
                        count: {
                            $sum: 1
                        }
                    }
                }
            ]);


        const applicationCountMap =
            new Map(
                applicationCounts.map(
                    item => [
                        item._id.toString(),
                        item.count
                    ]
                )
            );


        const formattedStudents =
            students.map(
                student => {

                    const profile =
                        profileMap.get(
                            student._id.toString()
                        );


                    return {

                        _id:
                            student._id,

                        name:
                            student.name,

                        email:
                            student.email,

                        mobile:
                            student.mobile || '',

                        isActive:
                            student.isActive,

                        createdAt:
                            student.createdAt,

                        profile:
                            profile || null,

                        applicationCount:
                            applicationCountMap.get(
                                student._id.toString()
                            ) || 0

                    };

                }
            );


        return res.status(200).json({

            success: true,

            count:
                formattedStudents.length,

            students:
                formattedStudents

        });


    } catch (error) {

        console.error(
            'Get all students error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Unable to fetch students.'

        });

    }

};


/* ============================================================
   GET STUDENT BY ID
============================================================ */

const getStudentById = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        const student =
            await User.findOne({
                _id: id,
                role: 'student'
            })
                .select(
                    'name email mobile isActive createdAt updatedAt'
                )
                .lean();


        if (!student) {

            return res.status(404).json({

                success: false,

                message:
                    'Student not found.'

            });

        }


        const profile =
            await StudentProfile.findOne({
                user: id
            })
                .lean();


        const applications =
            await ScholarshipApplication.find({
                student: id
            })
                .populate(
                    'scholarship',
                    'name academicYear scholarshipAmount status'
                )
                .select(
                    'applicationNumber status scholarship createdAt updatedAt submittedAt verifiedAt sanctionedAt disbursedAt'
                )
                .sort({
                    createdAt: -1
                })
                .lean();


        return res.status(200).json({

            success: true,

            student: {

                ...student,

                profile:
                    profile || null,

                applications

            }

        });


    } catch (error) {

        console.error(
            'Get student by ID error:',
            error
        );


        if (
            error.name ===
            'CastError'
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Student not found.'

            });

        }


        return res.status(500).json({

            success: false,

            message:
                'Unable to fetch student details.'

        });

    }

};


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {

    getAllStudents,

    getStudentById

};