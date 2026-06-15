const success = (res, data = {}, message = 'Success', statusCode = 200) =>
    res.status(statusCode).json({ success: true, message, data })

const error = (res, message = 'Error', statusCode = 400, data = null) =>
    res.status(statusCode).json({ success: false, message, ...(data && { data }) })

const paginated = (res, data, total, page, limit) =>
    res.status(200).json({
        success: true,
        data,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })

module.exports = { success, error, paginated }
