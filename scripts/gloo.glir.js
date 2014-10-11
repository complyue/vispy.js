/* WebGL utility functions */
function viewport(c) {
    c.gl.viewport(0, 0, c.width(), c.height());
}

function clear(c, color) {
    c.gl.clearColor(color[0], color[1], color[2], color[3]);
    c.gl.clear(c.gl.COLOR_BUFFER_BIT);
}

function compile_shader(c, type, source) {
    source = "precision mediump float;\n" + source;
    source = source.replace(/\\n/g, "\n")
    
    var shader = c.gl.createShader(c.gl[type]);

    c.gl.shaderSource(shader, source);
    c.gl.compileShader(shader);

    if (!c.gl.getShaderParameter(shader, c.gl.COMPILE_STATUS))
    {
        console.error(c.gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function attach_shaders(c, program, vertex, fragment) {
    c.gl.attachShader(program, vertex);
    c.gl.attachShader(program, fragment);
    c.gl.linkProgram(program);

    if (!c.gl.getProgramParameter(program, c.gl.LINK_STATUS))
    {
        console.warn("Could not initialise shaders on program '{0}'.".format(program));
    }
}

function create_attribute(c, program, name) {
    var attribute_handle = c.gl.getAttribLocation(program, name);
    return attribute_handle;
}

function activate_attribute(c, attribute_handle, vbo_id, type, stride, offset) {
    // attribute_handle: attribute handle
    // vbo_id
    // type: float, vec3, etc.
    // stride: 0 by default
    // offset: 0 by default
    var _attribute_info = get_attribute_info(type);
    var attribute_type = _attribute_info[0];  // FLOAT, INT or BOOL
    var ndim = _attribute_info[1]; // 1, 2, 3 or 4

    _vbo_info = c._ns[vbo_id];
    var vbo_handle = _vbo_info.handle;

    c.gl.enableVertexAttribArray(attribute_handle);
    c.gl.bindBuffer(c.gl.ARRAY_BUFFER, vbo_handle);
    c.gl.vertexAttribPointer(attribute_handle, ndim, 
                             c.gl[attribute_type],
                             false, stride, offset);
}

function deactivate_attribute(c, attribute_handle) {
    // c.gl.bindBuffer(c.gl.GL_ARRAY_BUFFER, 0);
    c.gl.disableVertexAttribArray(attribute_handle);
}

function activate_texture(c, texture_handle, sampler_handle, texture_index) {
    c.gl.activeTexture(c.gl.TEXTURE0 + texture_index);
    c.gl.bindTexture(c.gl.TEXTURE_2D, texture_handle);
    // c.gl.uniform1i(sampler_handle, 0);
}

function set_uniform(c, uniform_handle, uniform_function, value) {
    // Get a TypedArray.
    array = to_typed_array(value);

    if (uniform_function.indexOf('Matrix') > 0) {
        // Matrix uniforms.
        c.gl[uniform_function](uniform_handle, false, array);
    }
    else {
        // Scalar uniforms.
        c.gl[uniform_function](uniform_handle, array);
    }
}

function get_attribute_info(type) {
    // type: vec2, ivec3, float, etc.
    
    // Find OpenGL attribute type.
    var gl_type = 'FLOAT';
    if (type[0] == 'i' || type == 'int') {
        gl_type = 'INT';
    }
    
    // Find ndim.
    var ndim;
    if (type == 'int' || type == 'float') {
        ndim = 1;
    }
    else {
        ndim = parseInt(type.slice(-1));
    }

    return [gl_type, ndim];
}

function get_uniform_function(type) {
    // Samplers are always uniform1i.
    // if (type.indexOf('sampler') >= 0) {
    //     return 'uniform1i';
    // }

    // Find OpenGL attribute type.
    var type_char;
    var ndim;
    if (type[0] == 'i' || type == 'int') {
        type_char = 'i';
    }
    else {
        type_char = 'f';
    }
    
    // Find ndim.
    var ndim;
    if (type == 'int' || type == 'float') {
        ndim = 1;
    }
    else {
        ndim = parseInt(type.slice(-1));
    }

    return 'uniform{0}{1}v'.format(ndim, type_char);
}


/* Creation of vispy.gloo.glir */
define(["jquery"], function($) {
    var glir = function() {
        var that = this;
        // Constructor.
        VispyCanvas.prototype.call = function(command) {
            that.call(this, command);
        };
    };

    glir.prototype.init = function(c) {
        // Namespace with the table of all symbols used by GLIR.

        // The key is user-specified and is named the **id**.
        // The WebGL internal handle is called the **handle**.

        // For each id key, the value is an object with the following properties:
        // * object_type ('VertexBuffer', 'Program', etc.)
        // * handle (the WebGL internal handle, for all objects)
        // * data_type (for Buffers)
        // * offset (for Buffers)
        // * attributes (for Programs)
        // * uniforms (for Programs)
        c._ns = {};
    }

    glir.prototype.call = function(c, command) {
        var method = command[0].toLowerCase();
        this[method](c, command.slice(1));
    }

    glir.prototype.create = function(c, args) {
        var id = args[0];
        var cls = args[1];
        if (cls == 'VertexBuffer') {
            debug("Creating vertex buffer '{0}'.".format(id));
            c._ns[id] = {
                object_type: cls, 
                handle: c.gl.createBuffer(),
                size: 0,  // current size of the buffer
            };
        }
        else if (cls == 'IndexBuffer') {
            debug("Creating index buffer '{0}'.".format(id));
            c._ns[id] = {
                object_type: cls, 
                handle: c.gl.createBuffer(),
                size: 0,  // current size of the buffer
            };
        }
        else if (cls == 'Texture2D') {
            debug("Creating texture '{0}'.".format(id));
            c._ns[id] = {
                object_type: cls, 
                handle: c.gl.createTexture(),
                size: 0,  // current size of the texture
            };
        }
        else if (cls == 'Program') {
            debug("Creating program '{0}'.".format(id));
            c._ns[id] = {
                object_type: cls,
                handle: c.gl.createProgram(),
                attributes: {},
                uniforms: {},
                textures: {},
            };
        }
    };

    glir.prototype.delete = function(c, args) {
        var id = args[0];
        var cls = c._ns[id].object_type;
        var handle = c._ns[id].handle;
        if (cls == 'VertexBuffer') {
            debug("Deleting vertex buffer '{0}'.".format(id));
            c.gl.deleteBuffer(handle);
        }
        else if (cls == 'IndexBuffer') {
            debug("Deleting index buffer '{0}'.".format(id));
            c.gl.deleteBuffer(handle);
        }
        else if (cls == 'Texture2D') {
            debug("Deleting texture '{0}'.".format(id));
            c.gl.deleteTexture(handle);
        }
        else if (cls == 'Program') {
            debug("Deleting program '{0}'.".format(id));
            c.gl.deleteProgram(handle);
        }
    };

    glir.prototype.shaders = function(c, args) {
        var program_id = args[0];
        var vertex_code = args[1];
        var fragment_code = args[2];

        // Get the program handle.
        var handle = c._ns[program_id].handle;

        // Compile shaders.
        debug("Compiling shaders for program '{0}'.".format(program_id));
        var vs = compile_shader(c, 'VERTEX_SHADER', vertex_code);
        var fs = compile_shader(c, 'FRAGMENT_SHADER', fragment_code);

        // Attach shaders.
        debug("Attaching shaders for program '{0}'".format(program_id));
        attach_shaders(c, handle, vs, fs);
    }

    glir.prototype.data = function(c, args) {
        var buffer_id = args[0];
        var offset = args[1];
        var data = args[2];
        var size = data.length;
        var buffer = c._ns[buffer_id];
        var buffer_type = buffer.object_type; // VertexBuffer, IndexBuffer, or Texture2D
        var buffer_handle = buffer.handle;
        var gl_type;
        if (buffer_type == 'VertexBuffer') {
            gl_type = c.gl.ARRAY_BUFFER;
        }
        else if (buffer_type == 'IndexBuffer') {
            gl_type = c.gl.ELEMENT_ARRAY_BUFFER;
        }
        else if (buffer_type == 'Texture2D') {
            gl_type = c.gl.TEXTURE_2D;
            // buffer.shape = args[3];  // [width, height]
            // buffer.type = args[4];  // 'RGBA'
        }

        // Get a TypedArray.
        var array = to_typed_array(data);

        // Textures.
        if (buffer_type == 'Texture2D') {
            // The texture shape is given to the DATA command.
            var shape = args[3];
            var width = shape[0];
            var height = shape[1];

            // The texture type is given to the DATA command.
            var texture_type = args[4];
            var format = c.gl[texture_type];

            debug("Allocating texture '{0}'.".format(buffer_id));
            c.gl.bindTexture(gl_type, buffer_handle);
            c.gl.texImage2D(gl_type, 0, format, width, height, 0, 
                            format, c.gl.UNSIGNED_BYTE, array);
        }
        // Buffers
        else
        {
            // Bind the buffer before setting the data.
            c.gl.bindBuffer(gl_type, buffer_handle);

            // Upload the data.
            if (buffer.size == 0) {
                // The existing buffer was empty: we create it.
                debug("Allocating {0} elements in buffer '{1}'.".format(
                    size, buffer_id));
                c.gl.bufferData(gl_type, array, c.gl.STATIC_DRAW);
                buffer.size = size;
            }
            else {
                // We reuse the existing buffer.
                debug("Updating {0} elements in buffer '{1}', offset={2}.".format(
                    size, buffer_id, offset));
                c.gl.bufferSubData(gl_type, offset, array);
            }
        }
    }

    glir.prototype.attribute = function(c, args) {
        var program_id = args[0];
        var name = args[1];
        var type = args[2];
        var vbo_id = args[3];
        var stride = args[4];
        var offset = args[5];

        var program_handle = c._ns[program_id].handle;

        debug("Creating attribute '{0}' for program '{1}'.".format(
                name, program_id
            ));
        var attribute_handle = create_attribute(c, program_handle, name);

        // Store the attribute handle in the attributes array of the program.
        c._ns[program_id].attributes[name] = {
            handle: attribute_handle,
            type: type,
            vbo_id: vbo_id,
            stride: stride,
            offset: offset,
        };
    }

    glir.prototype.uniform = function(c, args) {
        var program_id = args[0];
        var name = args[1];
        var type = args[2];
        var value = args[3];
        
        var program_handle = c._ns[program_id].handle;

        c.gl.useProgram(program_handle);

        // Check the cache.
        if (c._ns[program_id].uniforms[name] == undefined) {
            // If necessary, we create the uniform and cache both its handle and
            // GL function.
            debug("Creating uniform '{0}' for program '{1}'.".format(
                    name, program_id
                ));
            var uniform_handle = c.gl.getUniformLocation(program_handle, name);
            var uniform_function = get_uniform_function(type);
            // We cache the uniform handle and the uniform function name as well.
            c._ns[program_id].uniforms[name] = [uniform_handle, uniform_function];
        }

        debug("Setting uniform '{0}' to '{1}' with {2} elements.".format(
                name, value, value.length
            ));
        var uniform_info = c._ns[program_id].uniforms[name];
        var uniform_handle = uniform_info[0];
        var uniform_function = uniform_info[1];
        set_uniform(c, uniform_handle, uniform_function, value);
    }

    glir.prototype.texture = function(c, args) {
        var program_id = args[0];
        var texture_id = args[1];
        var sampler_name = args[2];
        var texture_number = args[3];  // active texture

        var texture_handle = c._ns[texture_id].handle;
        var program_handle = c._ns[program_id].handle;
        
        debug("Initializing texture '{0}' for program '{1}'.".format(
                texture_id, program_id
            ));

        // Set the sampler uniform value.
        var sampler_handle = c.gl.getUniformLocation(program_handle, sampler_name);
        c.gl.uniform1i(sampler_handle, texture_number);

        c._ns[program_id].textures[texture_id] = {
            sampler_name: sampler_name,
            sampler_handle: sampler_handle,
            number: texture_number,
            handle: texture_handle,
        };  
    }

    glir.prototype.interpolation = function(c, args) {
        var texture_id = args[0];
        var min = args[1];
        var mag = args[2];
        var texture_handle = c._ns[texture_id].handle;
        
        var gl_type = c.gl.TEXTURE_2D;
        c.gl.bindTexture(gl_type, texture_handle);
        c.gl.texParameteri(gl_type, c.gl.TEXTURE_MIN_FILTER, c.gl[min]);
        c.gl.texParameteri(gl_type, c.gl.TEXTURE_MAG_FILTER, c.gl[mag]);
        c.gl.bindTexture(gl_type, null);
    }

    glir.prototype.wrapping = function(c, args) {
        var texture_id = args[0];
        var wrapping = args[1];
        var texture_handle = c._ns[texture_id].handle;
        
        var gl_type = c.gl.TEXTURE_2D;
        c.gl.bindTexture(gl_type, texture_handle);
        c.gl.texParameteri(gl_type, c.gl.TEXTURE_WRAP_S, c.gl[wrapping[0]]);
        c.gl.texParameteri(gl_type, c.gl.TEXTURE_WRAP_T, c.gl[wrapping[1]]);
        c.gl.bindTexture(gl_type, null);
    }

    glir.prototype.draw = function(c, args) {
        var program_id = args[0];
        var mode = args[1];
        var selection = args[2];

        var program_handle = c._ns[program_id].handle;
        var attributes = c._ns[program_id].attributes;
        var textures = c._ns[program_id].textures;

        // Activate all attributes in the program.
        for (attribute_name in attributes) {
            var attribute = attributes[attribute_name];
            debug("Activating attribute '{0}' for program '{1}'.".format(
                attribute_name, program_id));
            activate_attribute(c, attribute.handle, attribute.vbo_id, 
                attribute.type, attribute.stride, attribute.offset);
        }

        // Activate all textures in the program.
        for (texture_id in textures) {
            var texture = textures[texture_id];
            debug("Activating texture '{0}' for program '{1}'.".format(
                texture_id, program_id));
            activate_texture(c, texture.handle, texture.sampler_handle, texture.number);
        }

        // Activate the program.
        c.gl.useProgram(program_handle);

        // Draw the program.
        if (selection.length == 2) {
            // Draw the program without index buffer.
            var start = selection[0];
            var count = selection[1];
            debug("Rendering program '{0}' with {1}.".format(
                program_id, mode));
            c.gl.drawArrays(c.gl[mode], start, count);
        }     
        else if (selection.length == 3) {
            // Draw the program with index buffer.
            var index_buffer_id = selection[0];
            var index_buffer_type = selection[1];
            var count = selection[2];
            // Get the index buffer handle from the namespace.
            var index_buffer_handle = c._ns[index_buffer_id].handle;
            debug("Rendering program '{0}' with {1} and index buffer '{2}'.".format(
                program_id, mode, index_buffer_id));
            // Activate the index buffer.
            c.gl.bindBuffer(c.gl.ELEMENT_ARRAY_BUFFER, index_buffer_handle);
            // TODO: support index buffer offset? (last argument below, 0 by default)
            c.gl.drawElements(c.gl[mode], count, c.gl[index_buffer_type], 0);
        }

        // Deactivate attributes.
        for (attribute_name in attributes) {
            debug("Deactivating attribute '{0}' for program '{1}'.".format(
                attribute_name, program_id));
            deactivate_attribute(c, attributes[attribute_name].handle);
        }
    }

    glir.prototype.func = function(c, args) {
        var name = args[0];
        debug("Calling {0}({1}).".format(name, args.slice(1)));

        // Handle enums: replace strings by global GL variables.
        for (var i = 1; i < args.length; i++) {
            if (typeof args[i] === 'string') {
                args[i] = c.gl[args[i]];
            }
        }

        var func = c.gl[name];
        var func_args = args.slice(1)
        func.apply(c.gl, func_args);
    };

    return new glir();
});