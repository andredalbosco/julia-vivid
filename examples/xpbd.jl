# Julia Vivid: parameters, fields, calls, types, constants, and macros.
using LinearAlgebra: norm
using Printf: @sprintf

mutable struct Particle
    position::Vector{Float64}
    previous::Vector{Float64}
    velocity::Vector{Float64}
    inverse_mass::Float64
end

mutable struct DistanceConstraint
    a::Int
    b::Int
    rest_length::Float64
    compliance::Float64
    lambda::Float64
end

function solve_distance!(particles, c, h)
    a, b = particles[c.a], particles[c.b]
    delta = b.position - a.position
    distance = norm(delta)
    weight = a.inverse_mass + b.inverse_mass
    # Coincident endpoints have no defined distance gradient.
    (distance < 1e-12 || weight == 0) && return
    normal = delta / distance
    alpha = c.compliance / h^2
    dlambda = (-(distance - c.rest_length) - alpha * c.lambda) / (weight + alpha)
    a.position .-= (a.inverse_mass * dlambda) .* normal
    b.position .+= (b.inverse_mass * dlambda) .* normal
    c.lambda += dlambda
end

const CLOTH_COLUMNS = 21
const CLOTH_ROWS = 17
screen(p) = Vector{Float64}([p[1] * 100, 700 - p[2] * 100])
status(iterations) = @sprintf("iterations %d", iterations)
