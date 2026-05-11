import axios from 'axios';
import { config } from '@/config';

const request = axios.create({
    baseURL: config.base_url,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

let requestCount = 0;
let loadingInstance = null;

const endLoading = () => {
    requestCount--;
    if (requestCount === 0 && loadingInstance) {
        loadingInstance.close();
    }
};

request.interceptors.request.use(
    (config) => {
        if (config._timeout) {
            config.timeout = config._timeout;
        }

        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        config.headers['timestamp'] = Date.now();

        return config;
    },
    (error) => {
        console.error('请求拦截器错误:', error);
        console.error('请求失败，请稍后再试');
        return Promise.reject(error);
    }
);

request.interceptors.response.use(
    (response) => {
        if (response.status === 200 && response.data) {
            return response.data;
        } else {
            return Promise.reject(response.data?.message || '请求失败');
        }
    },
    (error) => {
        const status = error.response?.status;
        if (status === 401) {
            console.error('未授权，请登录');
        } else if (status === 403) {
            console.error('禁止访问');
        } else if (status === 404) {
            console.error('请求资源未找到');
        } else if (status === 500) {
            console.error('服务器内部错误');
        } else {
            console.error('请求失败');
        }
        return Promise.reject(error);
    }
);

const abortControllers = {};

function postFormRequest(url, data, _timeout) {
    if (abortControllers[url]) {
        console.log(`当前${url}已有请求，暂不发起新请求`);
        return abortControllers[url].requestPromise;
    }

    const controller = new AbortController();
    abortControllers[url] = controller;

    const requestPromise = request.post(url, data, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        _timeout: _timeout,
        signal: controller.signal
    }).finally(() => {
        if (abortControllers[url] === controller) {
            delete abortControllers[url];
        }
    });

    controller.requestPromise = requestPromise;
    return requestPromise;
}

function postJsonRequest(url, data, _timeout) {
    return request.post(url, data, {
        headers: {
            'Content-Type': 'application/json'
        },
        _timeout: _timeout
    });
}

function getRequest(url, data, _timeout){
    return request.get(url, {
        params: data,
        headers: {
            'Content-Type': 'application/json'
        },
        _timeout: _timeout
    });
}

function deleteRequest(url, data, _timeout){
    return request.delete(url, {
        params: data,
        headers: {
            'Content-Type': 'application/json'
        },
        _timeout: _timeout
    });
}

function putRequest(url, data, _timeout){
    return request.put(url, data, {
        headers: {
            'Content-Type': 'application/json'
        },
        _timeout: _timeout
    });
}

export { postFormRequest, postJsonRequest, getRequest, deleteRequest, putRequest };
